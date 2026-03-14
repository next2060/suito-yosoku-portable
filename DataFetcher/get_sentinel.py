import sys
import os
import glob
import ssl
import planetary_computer
from pystac_client import Client
import rioxarray
import rasterio
from rasterio.enums import Resampling
from rasterio.features import rasterize
import geopandas as gpd
import requests
import urllib3
from shapely.geometry import shape
import calendar
import numpy as np
from skimage.filters import threshold_otsu
from rasterstats import zonal_stats
import json
import pandas as pd
from PIL import Image

# SSL証明書の警告を非表示
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ==========================================
# 0. 基本の通信設定（SSL回避等）
# ==========================================
ssl._create_default_https_context = ssl._create_unverified_context

old_request = requests.Session.request
def new_request(self, method, url, **kwargs):
    kwargs['verify'] = False
    return old_request(self, method, url, **kwargs)
requests.Session.request = new_request

# ==========================================
# メイン処理
# ==========================================
def main():
    print("===================================================")
    print("  水稲生育・湛水予測システム (統合取得ツール Ver.Pro)")
    print("===================================================\n")

    # --- ネットワーク環境の選択 ---
    print("=== 通信環境を選んでください ===")
    print(" 1 : 庁内ネットワーク (県庁プロキシを使用)")
    print(" 2 : 庁外ネットワーク (自宅・テザリング等 / プロキシなし)")
    print("===================================")
    while True:
        net_choice = input("番号を入力してください (1 または 2): ").strip()
        if net_choice in ['1', '2']:
            use_proxy = (net_choice == '1')
            break
        print("※ 1 または 2 のいずれかを入力してください！")

    if use_proxy:
        proxy_url = "http://Z4B04.pref.ibaraki.jp:8000"
        os.environ["HTTP_PROXY"] = proxy_url
        os.environ["HTTPS_PROXY"] = proxy_url
        print("\n-> 庁内ネットワーク (プロキシあり) で通信します。\n")
    else:
        proxy_url = ""
        os.environ["HTTP_PROXY"] = ""
        os.environ["HTTPS_PROXY"] = ""
        print("\n-> 庁外ネットワーク (プロキシなし) で通信します。\n")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # フォルダパスの設定
    fields_dir = os.path.abspath(os.path.join(script_dir, "..", "data_folder", "fields"))
    user_db_dir = os.path.abspath(os.path.join(script_dir, "..", "data_folder", "user_db"))
    base_out_dir = os.path.abspath(os.path.join(script_dir, "..", "data_folder", "satellite"))
    os.makedirs(base_out_dir, exist_ok=True)

    geojson_files = glob.glob(os.path.join(fields_dir, "*.geojson"))
    user_json_files = glob.glob(os.path.join(user_db_dir, "*.json"))

    if not geojson_files:
        print(f"エラー: {fields_dir} にGeoJSONファイルが見つかりません。")
        return

    # --- 0. 解析モードの選択 ---
    print("===================================")
    print(" 実行する解析モードを選んでください")
    print("===================================")
    print(" 1 : 生育調査 (Sentinel-2 光学 : NDVI ＋ 個別メッシュPNG)")
    print(" 2 : 湛水調査 (Sentinel-2 光学 : MNDWI)")
    print(" 3 : 視覚確認 (Sentinel-2 光学 : True Color)")
    print(" 4 : 湛水調査 (Sentinel-1 SAR : 雲透過・論文準拠)")
    print("===================================")
    while True:
        mode = input("番号を入力してください (1, 2, 3, 4): ").strip()
        if mode in ['1', '2', '3', '4']:
            break
        print("※ 1〜4 のいずれかを入力してください！")

    if mode == '1':
        mode_name = "生育調査(NDVI)"
        out_dir = os.path.join(base_out_dir, "NDVI")
    elif mode == '2':
        mode_name = "湛水調査(MNDWI)"
        out_dir = os.path.join(base_out_dir, "Flooded")
    elif mode == '3':
        mode_name = "視覚確認(True Color)"
        out_dir = os.path.join(base_out_dir, "TrueColor")
    else:
        mode_name = "SAR湛水調査(雲透過)"
        out_dir = os.path.join(base_out_dir, "SAR_Flooded")
        
    os.makedirs(out_dir, exist_ok=True)
        
    print(f"\n【{mode_name} モード】で起動します。")
    print(f" -> 保存先フォルダ: {out_dir}\n")

    # --- 1. 対象ユーザー(user_db)の選択 (※モード1,3のみ / DB必須) ---
    if mode in ['1', '3']:
        if not user_json_files:
            print(f"エラー: {user_db_dir} にユーザーDBファイル(.json)が見つかりません。")
            print("NDVIおよびTrueColorモードではユーザーDBの選択が必須です。")
            return
        print("=== 処理対象のユーザー(圃場リスト)を選んでください ===")
        user_file_list = []
        for i, path in enumerate(user_json_files, 1):
            name = os.path.splitext(os.path.basename(path))[0]
            user_file_list.append((name, path))
            print(f" {i:2d} : {name}")
        print("===================================")

        while True:
            choice = input("番号を入力してください: ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(user_file_list):
                selected_user_name, selected_user_path = user_file_list[int(choice) - 1]
                print(f"\n-> [{selected_user_name}] の圃場のみを抽出して処理します。")
                break
            print("※正しい番号を入力してください！")
    else:
        # モード2, 4 (湛水調査) の場合はユーザー選択をスキップし、市町村全体を対象にする
        selected_user_path = None
        selected_user_name = "全圃場"

    # --- 2. 市町村(GeoJSON)の選択 ---
    print("\n=== 対象の市町村(地図データ)を選んでください ===")
    file_list = []
    for i, path in enumerate(geojson_files, 1):
        name = os.path.splitext(os.path.basename(path))[0]
        file_list.append((name, path))
        print(f" {i:2d} : {name}")
    print("===================================")

    while True:
        choice = input("番号を入力してください: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(file_list):
            selected_name, selected_path = file_list[int(choice) - 1]
            break
        print("※正しい番号を入力してください！")

    print(f"\n[{selected_name}] の地図データを選択しました。")

    # --- 3. 年月の入力 ---
    while True:
        try:
            year = int(input("\n取得する年を入力してください (例: 2025): "))
            month = int(input("取得する月を入力してください (例: 8): "))
            if 1 <= month <= 12:
                break
            print("※月は1〜12で入力してください！")
        except ValueError:
            print("※正しい数字で入力してください！")

    _, last_day = calendar.monthrange(year, month)
    date_range = f"{year}-{month:02d}-01/{year}-{month:02d}-{last_day:02d}"

    # --- 4. 地図データの読み込みとユーザーフィルタリング ---
    gdf = gpd.read_file(selected_path)
    if gdf.crs != "EPSG:4326":
        gdf = gdf.to_crs("EPSG:4326")

    if selected_user_path:
        with open(selected_user_path, 'r', encoding='utf-8') as f:
            user_data = json.load(f)
        
        target_uuids = list(user_data.keys())
        
        uuid_col = None
        for col in ['polygon_uuid', 'id', 'ポリゴンUUID']:
            if col in gdf.columns:
                uuid_col = col
                break
                
        if uuid_col:
            gdf = gdf[gdf[uuid_col].isin(target_uuids)]
            if gdf.empty:
                print(f"エラー: 選択した市町村の中に、{selected_user_name} の圃場が1件も見つかりませんでした。")
                return
            
            gdf = gdf.reset_index(drop=True)
            print(f" -> {selected_user_name} の圃場 {len(gdf)} 件を抽出完了！")
        else:
            print("エラー: GeoJSON内にUUIDを特定できる列(polygon_uuid等)が見つかりません。")
            return
    
    shapes = [geom for geom in gdf.geometry if geom is not None and geom.is_valid]
    if not shapes:
        print("有効な圃場ポリゴンがありません。")
        return

    minx, miny, maxx, maxy = gdf.total_bounds
    bbox = [minx, miny, maxx, maxy]

    gdf_proj = gdf.to_crs("EPSG:3857")
    target_geom = gdf_proj.geometry.union_all()
    target_area = target_geom.area

    # --- 5. 画像の検索 ---
    catalog = Client.open(
        "https://planetarycomputer.microsoft.com/api/stac/v1", 
        modifier=planetary_computer.sign_inplace
    )

    if mode in ['1', '2', '3']:
        target_collection = "sentinel-2-l2a"
        print(f"\n{year}年{month}月の光学画像(Sentinel-2)を検索中...")
    else:
        target_collection = "sentinel-1-rtc"
        print(f"\n{year}年{month}月のSAR画像(Sentinel-1)を検索中...")

    search = catalog.search(
        collections=[target_collection],
        bbox=bbox,
        datetime=date_range
    )
    items = list(search.items())

    if not items:
        print("指定された月の画像は見つかりませんでした。")
        return

    print("画像を解析中（エリアカバー率などを計算しています）...")
    
    candidate_list = []
    for item in items:
        date_str = item.datetime.strftime('%Y-%m-%d %H:%M')
        
        item_geom = shape(item.geometry)
        item_gdf = gpd.GeoDataFrame(geometry=[item_geom], crs="EPSG:4326").to_crs("EPSG:3857")
        intersection_area = target_geom.intersection(item_gdf.geometry[0]).area
        coverage_percent = (intersection_area / target_area) * 100

        if mode in ['1', '2', '3']:
            cloud_cover = item.properties.get("eo:cloud_cover", 100.0)
            candidate_list.append({
                "item": item,
                "date": date_str,
                "cloud": cloud_cover,
                "coverage": coverage_percent
            })
        else:
            if coverage_percent > 0:
                candidate_list.append({
                    "item": item,
                    "date": date_str,
                    "coverage": coverage_percent
                })

    candidate_list.sort(key=lambda x: x["date"])

    if not candidate_list:
        print("対象エリアをカバーする画像がありませんでした。")
        return

    # --- 6. 画像の選択 ---
    if mode in ['1', '2', '3']:
        print("\n=== 取得可能な光学画像リスト ===")
        for i, info in enumerate(candidate_list, 1):
            print(f" {i:2d} : {info['date']} | 雲量: {info['cloud']:5.1f}% | エリアカバー率: {info['coverage']:5.1f}%")
    else:
        print("\n=== 取得可能なSAR画像リスト (※雲を透過するため雲量なし) ===")
        for i, info in enumerate(candidate_list, 1):
            print(f" {i:2d} : {info['date']} | エリアカバー率: {info['coverage']:5.1f}%")
            
    print("============================")

    while True:
        choice = input("取得したい画像の番号を入力してください: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(candidate_list):
            selected_info = candidate_list[int(choice) - 1]
            break
        print("※正しい番号を入力してください！")

    item = selected_info["item"]
    print(f"\n選択された画像: {selected_info['date']} のダウンロードを開始します...")
    date_only = selected_info['date'][:10]

    env_kwargs = {
        "GDAL_HTTP_UNSAFESSL": "YES",
        "GDAL_DISABLE_READDIR_ON_OPEN": "EMPTY_DIR",
        "CPL_VSIL_CURL_ALLOWED_EXTENSIONS": "tif,tiff",
        "GDAL_HTTP_TIMEOUT": "120",
        "GDAL_HTTP_MAX_RETRY": "5",
        "GDAL_HTTP_RETRY_DELAY": "3",
        "VSI_CACHE": "TRUE",
        "GDAL_INGESTED_BYTES_AT_OPEN": "32000"
    }
    if use_proxy:
        env_kwargs["GDAL_HTTP_PROXY"] = proxy_url

    gdal_env = rasterio.Env(**env_kwargs)
    user_suffix = f"_{selected_user_name}" if selected_user_path else ""

    # ==========================================
    # 7. モード別：ダウンロードと解析処理
    # ==========================================
    with gdal_env:
        if mode == '1':
            # ---------------------------
            # 【モード1】NDVI (生育調査 ＋ 個別メッシュ)
            # ---------------------------
            url_red = item.assets["B04"].href
            url_nir = item.assets["B08"].href

            red_box = rioxarray.open_rasterio(url_red).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            nir_box = rioxarray.open_rasterio(url_nir).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            
            red_box.rio.write_nodata(np.nan, inplace=True)
            nir_box.rio.write_nodata(np.nan, inplace=True)
            
            print(" -> 圃場ポリゴンで正確に型抜き中...")
            red_data = red_box.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load().squeeze()
            nir_data = nir_box.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load().squeeze()

            print(" -> NDVIを計算中...")
            ndvi_da = (nir_data - red_data) / (nir_data + red_data + 1e-10)
            ndvi_da.name = "NDVI"
            ndvi_da.rio.write_nodata(np.nan, inplace=True)

            print(" -> 圃場ごとのNDVI平均値計算と、個別メッシュ画像の作成中...")
            raster_crs = ndvi_da.rio.crs
            gdf_matched = gdf.to_crs(raster_crs)
            affine = ndvi_da.rio.transform()
            
            stats = zonal_stats(gdf_matched.geometry, ndvi_da.values, affine=affine, stats="mean", nodata=np.nan)
            
            mesh_dir = os.path.join(out_dir, f"mesh_{selected_name}{user_suffix}_{date_only}")
            os.makedirs(mesh_dir, exist_ok=True)

            ndvi_results = []
            for i, row in gdf.iterrows():
                uuid = row.get('polygon_uuid', row.get('id', row.get('ポリゴンUUID', f'unknown_{i}')))
                mean_val = stats[i]['mean']
                
                ndvi_val = round(float(mean_val), 2) if mean_val is not None else None
                
                ndvi_results.append({
                    "ポリゴンUUID": uuid,
                    "ndvi_mean": ndvi_val
                })

                # --- 個別メッシュ(PNG)の作成処理 (ダブルクリップ方式) ---
                try:
                    single_geom = [row.geometry]
                    
                    # 1. まずは10mメッシュで荒く切り出し
                    clipped_da = ndvi_da.rio.clip(single_geom, gdf.crs, drop=True)
                    
                    # 2. EPSG:4326に変換
                    clipped_da_4326 = clipped_da.rio.reproject("EPSG:4326")
                    
                    # 3. カクカクのまま解像度を20倍に（0.5m相当のメッシュ化）
                    scale = 20
                    new_width = len(clipped_da_4326.x) * scale
                    new_height = len(clipped_da_4326.y) * scale
                    upscaled_da = clipped_da_4326.rio.reproject(
                        clipped_da_4326.rio.crs,
                        shape=(new_height, new_width),
                        resampling=Resampling.nearest
                    )
                    
                    # 4. 高解像度状態でポリゴンに合わせてフチを綺麗に切り抜き
                    final_clipped_da = upscaled_da.rio.clip(single_geom, gdf.crs, drop=True, all_touched=True)
                    
                    ndvi_vals = final_clipped_da.values
                    if ndvi_vals.ndim == 3:
                        ndvi_vals = ndvi_vals[0]
                        
                    h, w = ndvi_vals.shape
                    rgba = np.zeros((h, w, 4), dtype=np.uint8)

                    # 農業特化型の5段階カラーパレット＆閾値
                    c1 = [255, 255, 191, 255] # #ffffbf (Yellow - very low NDVI)
                    c2 = [204, 235, 137, 255] # #cceb89 (Light Yellow-Green)
                    c3 = [145, 207, 96, 255]  # #91cf60 (Green)
                    c4 = [64, 169, 71, 255]   # #40a947 (Medium Dark Green)
                    c5 = [26, 150, 65, 255]   # #1a9641 (Dark Green - very high NDVI)

                    rgba[ndvi_vals < 0.30] = c1
                    rgba[(ndvi_vals >= 0.30) & (ndvi_vals < 0.50)] = c2
                    rgba[(ndvi_vals >= 0.50) & (ndvi_vals < 0.65)] = c3
                    rgba[(ndvi_vals >= 0.65) & (ndvi_vals < 0.80)] = c4
                    rgba[ndvi_vals >= 0.80] = c5
                    rgba[np.isnan(ndvi_vals)] = [0, 0, 0, 0]

                    out_png = os.path.join(mesh_dir, f"{uuid}.png")
                    Image.fromarray(rgba, 'RGBA').save(out_png)

                    bounds = final_clipped_da.rio.bounds() 
                    leaflet_bounds = [[bounds[1], bounds[0]], [bounds[3], bounds[2]]]
                    out_bounds = os.path.join(mesh_dir, f"{uuid}_bounds.json")
                    with open(out_bounds, 'w', encoding='utf-8') as bf:
                        json.dump({"bounds": leaflet_bounds}, bf, indent=2)

                except Exception as e:
                    pass
            
            out_json = os.path.join(out_dir, f"NDVI_Results_{selected_name}{user_suffix}_{date_only}.json")
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(ndvi_results, f, ensure_ascii=False, indent=2)
            print(f"✅ 全体のJSON保存完了: {out_json}")
            print(f"✅ 個別メッシュ画像(PNG)の出力完了: {mesh_dir}/ フォルダ内")

            out_tiff = os.path.join(out_dir, f"NDVI_{selected_name}{user_suffix}_{date_only}.tif")
            print(" -> EPSG:4326に変換してGeoTIFFを保存しています...")
            ndvi_da_4326 = ndvi_da.rio.reproject("EPSG:4326")
            ndvi_da_4326.rio.to_raster(out_tiff)
            print(f"✅ TIFF保存完了: {out_tiff}")

        elif mode == '2':
            # ---------------------------
            # 【モード2】MNDWI (湛水調査 光学)
            # ---------------------------
            url_b03 = item.assets["B03"].href
            url_b08 = item.assets["B08"].href
            url_b11 = item.assets["B11"].href

            b03_box = rioxarray.open_rasterio(url_b03).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            b08_box = rioxarray.open_rasterio(url_b08).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            b11_box = rioxarray.open_rasterio(url_b11).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            
            b03_box.rio.write_nodata(np.nan, inplace=True)
            b08_box.rio.write_nodata(np.nan, inplace=True)
            b11_box.rio.write_nodata(np.nan, inplace=True)
            
            print(" -> Band11をBand8に合わせてパンシャープン処理中...")
            b11_matched = b11_box.rio.reproject_match(b08_box, resampling=Resampling.cubic)

            print(" -> 圃場ポリゴンで正確に型抜き中...")
            b03_data = b03_box.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load().squeeze()
            b11_data = b11_matched.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load().squeeze()

            print(" -> MNDWIを計算中...")
            mndwi_da = (b03_data - b11_data) / (b03_data + b11_data + 1e-10)
            mndwi_da.name = "MNDWI"
            mndwi_da.rio.write_nodata(np.nan, inplace=True)

            print(" -> 大津法(Otsu's method)で水判定の閾値を計算中...")
            valid_pixels = mndwi_da.values
            valid_pixels = valid_pixels[~np.isnan(valid_pixels) & (valid_pixels > -1.0) & (valid_pixels < 1.0)]

            if valid_pixels.size > 0:
                threshold = threshold_otsu(valid_pixels)
                print(f" 🎯 決定閾値 (大津法): {threshold:.4f}")
                
                binary_da = (mndwi_da >= threshold).astype(float)
                binary_da = binary_da.where(mndwi_da.notnull(), np.nan)
                
                print(" -> 圃場ごとの入水判定（50%ルール）を計算中...")
                raster_crs = binary_da.rio.crs
                gdf_matched = gdf.to_crs(raster_crs)
                
                affine = binary_da.rio.transform()
                stats = zonal_stats(gdf_matched.geometry, binary_da.values, affine=affine, stats="mean", nodata=np.nan)
                
                gdf['water_ratio'] = [s['mean'] if s['mean'] is not None else 0 for s in stats]
                gdf['is_flooded'] = gdf['water_ratio'] >= 0.5
                
                flooded_results = []

                # Compute area first so we can include per-field area_ha in results
                gdf_proj = gdf.to_crs("EPSG:6677")
                gdf['area_ha'] = gdf_proj.geometry.area / 10000.0

                for i, row in gdf.iterrows():
                    uuid = row.get('polygon_uuid', row.get('id', row.get('ポリゴンUUID', f'unknown_{i}')))
                    flooded_results.append({
                        "ポリゴンUUID": uuid,
                        "water_ratio": round(float(row['water_ratio']), 2),
                        "is_flooded": bool(row['is_flooded']),
                        "area_ha": round(float(row['area_ha']), 4)
                    })
                
                total_ha = gdf['area_ha'].sum()
                flooded_ha = gdf[gdf['is_flooded']]['area_ha'].sum()
                progress_pct = (flooded_ha / total_ha) * 100 if total_ha > 0 else 0
                total_fields = len(gdf)
                flooded_fields = int(gdf['is_flooded'].sum())

                output_data = {
                    "summary": {
                        "total_area_ha": round(float(total_ha), 2),
                        "flooded_area_ha": round(float(flooded_ha), 2),
                        "progress_pct": round(float(progress_pct), 1),
                        "total_fields": total_fields,
                        "flooded_fields": flooded_fields
                    },
                    "results": flooded_results
                }

                out_json = os.path.join(out_dir, f"Flooded_Results_{selected_name}{user_suffix}_{date_only}.json")
                with open(out_json, 'w', encoding='utf-8') as f:
                    json.dump(output_data, f, ensure_ascii=False, indent=2)
                print(f"✅ JSON保存完了: {out_json}")

                print("\n==============================================")
                print(f" 🌾 【{selected_name}{user_suffix}】 湛水進捗レポート ({date_only})")
                print(f" -> 入水済面積 : {flooded_ha:,.1f} ha / 全圃場面積 : {total_ha:,.1f} ha")
                print(f" -> 湛水進捗率 : {progress_pct:.1f} %")
                print("==============================================\n")

                print(" -> 判定結果のGeoTIFFを作成中...")
                shapes_for_rasterize = ((geom, 1 if is_flooded else 0) for geom, is_flooded in zip(gdf_matched.geometry, gdf['is_flooded']))
                
                flooded_array = rasterize(
                    shapes=shapes_for_rasterize,
                    out_shape=binary_da.shape,
                    transform=affine,
                    fill=np.nan,
                    dtype=float
                )
                
                flooded_da = binary_da.copy(data=flooded_array)
                flooded_da.name = "Flooded_Fields"
                flooded_da.rio.write_nodata(np.nan, inplace=True)
                
                out_mndwi = os.path.join(out_dir, f"MNDWI_{selected_name}{user_suffix}_{date_only}.tif")
                out_flooded = os.path.join(out_dir, f"Flooded_{selected_name}{user_suffix}_{date_only}.tif")
                
                print(" -> EPSG:4326に変換してGeoTIFFを保存しています...")
                mndwi_da_4326 = mndwi_da.rio.reproject("EPSG:4326")
                flooded_da_4326 = flooded_da.rio.reproject("EPSG:4326", resampling=Resampling.nearest)
                
                mndwi_da_4326.rio.to_raster(out_mndwi)       
                flooded_da_4326.rio.to_raster(out_flooded)   
                
                print(f"✅ TIFF保存完了: {out_mndwi}")
                print(f"✅ TIFF保存完了: {out_flooded}")
            else:
                print("エラー：有効なデータがないため閾値が計算できませんでした。")

        elif mode == '3':
            # ---------------------------
            # 【モード3】True Color (RGB)
            # ---------------------------
            url_visual = item.assets["visual"].href
            visual_box = rioxarray.open_rasterio(url_visual).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            visual_box.rio.write_nodata(np.nan, inplace=True)
            print(" -> 圃場ポリゴンで正確に型抜き中...")
            visual_data = visual_box.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load()
            out_tiff = os.path.join(out_dir, f"TrueColor_{selected_name}{user_suffix}_{date_only}.tif")
            print(" -> EPSG:4326に変換してGeoTIFFを保存しています...")
            visual_da_4326 = visual_data.rio.reproject("EPSG:4326", resampling=Resampling.nearest)
            visual_da_4326 = visual_da_4326.fillna(0).astype("uint8")
            visual_da_4326.rio.write_nodata(0, inplace=True)
            visual_da_4326.rio.to_raster(out_tiff)
            print(f"✅ TIFF保存完了: {out_tiff}")

        elif mode == '4':
            # ---------------------------
            # 【モード4】SAR 湛水調査 (論文準拠)
            # ---------------------------
            try:
                url_vv = item.assets["vv"].href
            except KeyError:
                print("エラー: 選択した画像に 'vv' バンドが含まれていません。別の画像をお試しください。")
                return

            print(" -> VVバンドのダウンロードと型抜き中...")
            vv_box = rioxarray.open_rasterio(url_vv).rio.clip_box(*bbox, crs="EPSG:4326").astype(float)
            vv_box.rio.write_nodata(np.nan, inplace=True)
            vv_data = vv_box.rio.clip(shapes, gdf.crs, drop=True, from_disk=False).load().squeeze()

            print(" -> リニア値をデシベル(dB)に変換中...")
            vv_db = 10 * np.log10(vv_data + 1e-10)
            vv_db.name = "SAR_VV_dB"
            vv_db.rio.write_nodata(np.nan, inplace=True)

            print(" -> 圃場ごとの平均dB値計算中...")
            raster_crs = vv_db.rio.crs
            gdf_matched = gdf.to_crs(raster_crs)
            affine = vv_db.rio.transform()
            
            stats = zonal_stats(gdf_matched.geometry, vv_db.values, affine=affine, stats="mean", nodata=np.nan)
            
            gdf['mean_db'] = [s['mean'] if s['mean'] is not None else np.nan for s in stats]
            
            threshold_db = -14.0
            print(f" 🎯 判定閾値: {threshold_db:.1f} dB 以下の圃場を「湛水あり」と判定します。")
            gdf['is_flooded'] = gdf['mean_db'] <= threshold_db

            flooded_results = []

            # Compute area first so we can include per-field area_ha in results
            gdf_proj = gdf.to_crs("EPSG:6677")
            gdf['area_ha'] = gdf_proj.geometry.area / 10000.0

            for i, row in gdf.iterrows():
                uuid = row.get('polygon_uuid', row.get('id', row.get('ポリゴンUUID', f'unknown_{i}')))
                flooded_results.append({
                    "ポリゴンUUID": uuid,
                    "mean_db": round(float(row['mean_db']), 2) if not pd.isna(row['mean_db']) else None,
                    "is_flooded": bool(row['is_flooded']),
                    "area_ha": round(float(row['area_ha']), 4)
                })
            
            total_ha = gdf['area_ha'].sum()
            flooded_ha = gdf[gdf['is_flooded']]['area_ha'].sum()
            progress_pct = (flooded_ha / total_ha) * 100 if total_ha > 0 else 0
            total_fields = len(gdf)
            flooded_fields = int(gdf['is_flooded'].sum())

            output_data = {
                "summary": {
                    "total_area_ha": round(float(total_ha), 2),
                    "flooded_area_ha": round(float(flooded_ha), 2),
                    "progress_pct": round(float(progress_pct), 1),
                    "total_fields": total_fields,
                    "flooded_fields": flooded_fields
                },
                "results": flooded_results
            }

            out_json = os.path.join(out_dir, f"SAR_Flooded_Results_{selected_name}{user_suffix}_{date_only}.json")
            with open(out_json, 'w', encoding='utf-8') as f:
                json.dump(output_data, f, ensure_ascii=False, indent=2)
            print(f"✅ 全体のJSON保存完了: {out_json}")

            print("\n==============================================")
            print(f" 🌾 【{selected_name}{user_suffix}】 SAR湛水進捗レポート ({date_only})")
            print(f" -> 入水済面積 : {flooded_ha:,.1f} ha / 全圃場面積 : {total_ha:,.1f} ha")
            print(f" -> 湛水進捗率 : {progress_pct:.1f} %")
            print("==============================================\n")

            print(" -> 判定結果のGeoTIFFを作成中...")
            shapes_for_rasterize = ((geom, 1 if is_flooded else 0) for geom, is_flooded in zip(gdf_matched.geometry, gdf['is_flooded']))
            
            flooded_array = rasterize(
                shapes=shapes_for_rasterize,
                out_shape=vv_db.shape,
                transform=affine,
                fill=np.nan,
                dtype=float
            )
            
            flooded_da = vv_db.copy(data=flooded_array)
            flooded_da.name = "SAR_Flooded_Fields"
            flooded_da.rio.write_nodata(np.nan, inplace=True)
            
            out_vv_db = os.path.join(out_dir, f"SAR_VV_dB_{selected_name}{user_suffix}_{date_only}.tif")
            out_flooded = os.path.join(out_dir, f"SAR_Flooded_{selected_name}{user_suffix}_{date_only}.tif")
            
            print(" -> EPSG:4326に変換してGeoTIFFを保存しています...")
            vv_db_4326 = vv_db.rio.reproject("EPSG:4326")
            flooded_da_4326 = flooded_da.rio.reproject("EPSG:4326", resampling=Resampling.nearest)
            
            vv_db_4326.rio.to_raster(out_vv_db)       
            flooded_da_4326.rio.to_raster(out_flooded)   
            
            print(f"✅ TIFF保存完了: {out_vv_db}")
            print(f"✅ TIFF保存完了: {out_flooded}")

    print("\nすべての処理が完了しました！QGISやブラウザアプリで確認してみてください！")

if __name__ == "__main__":
    main()
    os._exit(0)