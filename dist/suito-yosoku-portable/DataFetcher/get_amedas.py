import sys
import time
import pandas as pd
import numpy as np
import os
from datetime import datetime, timedelta
import requests
from bs4 import BeautifulSoup
import urllib3

# SSL証明書の警告を非表示
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 真の観測所ID（茨城40を除いた個別コード）
STATIONS = {
    "北茨城": {"block_no": "0315", "type": "a"},
    "大子": {"block_no": "0316", "type": "a"},
    "常陸大宮": {"block_no": "1331", "type": "a"},
    "日立": {"block_no": "1011", "type": "a"},
    "笠間": {"block_no": "0318", "type": "a"},
    "水戸": {"block_no": "47629", "type": "s"}, 
    "古河": {"block_no": "0320", "type": "a"},
    "下館": {"block_no": "1530", "type": "a"},
    "下妻": {"block_no": "0322", "type": "a"},
    "鉾田": {"block_no": "1245", "type": "a"},
    "つくば": {"block_no": "47646", "type": "s"}, 
    "土浦": {"block_no": "0324", "type": "a"},
    "鹿嶋": {"block_no": "0325", "type": "a"},
    "龍ケ崎": {"block_no": "1014", "type": "a"}
}

def clean_val(val_str, is_precip=False):
    """取得した1つの文字列の記号を掃除して数値にする"""
    s = str(val_str).replace(']', '').replace(')', '').replace('×', '').replace('///', '').strip()
    if is_precip:
        if s in ['', '--', 'nan']: return 0.0
    else:
        if s in ['', '--']: return np.nan
    try:
        return float(s)
    except ValueError:
        return np.nan

def fetch_year_data(year, station_info, use_proxy):
    prec_no = 40
    block_no = station_info["block_no"]
    st_type = station_info["type"]
    all_data = []

    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'}
    
    # ユーザーの選択に応じてプロキシを設定
    if use_proxy:
        proxy_url = "http://Z4B04.pref.ibaraki.jp:8000"
        proxies = {"http": proxy_url, "https": proxy_url}
    else:
        proxies = None

    for month in range(4, 11):
        if st_type == "s":
            url = f"https://www.data.jma.go.jp/obd/stats/etrn/view/daily_s1.php?prec_no={prec_no}&block_no={block_no}&year={year}&month={month}&day=&view="
        else:
            url = f"https://www.data.jma.go.jp/obd/stats/etrn/view/daily_a1.php?prec_no={prec_no}&block_no={block_no}&year={year}&month={month}&day=&view="

        try:
            # プロキシの有無でリクエストを自動切替
            if use_proxy:
                response = requests.get(url, headers=headers, proxies=proxies, verify=False, timeout=15)
            else:
                response = requests.get(url, headers=headers, verify=False, timeout=15)
                
            response.raise_for_status()
            response.encoding = response.apparent_encoding
            
            soup = BeautifulSoup(response.text, "html.parser")
            rows = soup.find_all('tr', class_='mtx')
            
            for row in rows:
                cols = row.find_all('td')
                if not cols:
                    continue
                
                day_str = cols[0].text.strip()
                if not day_str.isdigit():
                    continue
                
                day = int(day_str)
                date_str = f"{month:02d}-{day:02d}"

                if st_type == "s":
                    precip = clean_val(cols[3].text, is_precip=True)
                    temp = clean_val(cols[6].text, is_precip=False)
                    temp_max = clean_val(cols[7].text, is_precip=False)
                    temp_min = clean_val(cols[8].text, is_precip=False)
                else:
                    precip = clean_val(cols[1].text, is_precip=True)
                    temp = clean_val(cols[4].text, is_precip=False)
                    temp_max = clean_val(cols[5].text, is_precip=False)
                    temp_min = clean_val(cols[6].text, is_precip=False)

                all_data.append({
                    "Date": date_str,
                    "Temp": temp,
                    "Temp_max": temp_max,
                    "Temp_min": temp_min,
                    "precip": precip
                })
                
            time.sleep(1) # サーバー負荷軽減

        except Exception as e:
            pass

    if all_data:
        return pd.DataFrame(all_data)
    return pd.DataFrame()

def process_station(city_name, target_year, get_avg_flag, use_proxy):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.normpath(os.path.join(script_dir, "..", "data_folder", "weather"))
    os.makedirs(out_dir, exist_ok=True)
    
    station_info = STATIONS[city_name]

    print(f"\n=====================================")
    print(f" 📍 【{city_name}】のデータを取得開始")
    print(f"=====================================")

    base_dates = pd.date_range("2000-04-01", "2000-10-31").strftime("%m-%d")
    base_df = pd.DataFrame({"Date": base_dates})

    act_raw_df = fetch_year_data(target_year, station_info, use_proxy)
    
    now = datetime.now()
    current_year = now.year
    yesterday_str = (now - timedelta(days=1)).strftime("%m-%d")

    if not act_raw_df.empty:
        if target_year == current_year:
            act_raw_df = act_raw_df[act_raw_df["Date"] <= yesterday_str]
        elif target_year > current_year:
            act_raw_df = pd.DataFrame(columns=["Date", "Temp", "Temp_max", "Temp_min", "precip"])

        act_df = pd.merge(base_df, act_raw_df, on="Date", how="left")
    else:
        act_df = base_df.copy()
        for col in ["Temp", "Temp_max", "Temp_min", "precip"]:
            act_df[col] = np.nan

    act_path = os.path.join(out_dir, f"{city_name}{target_year}_act.csv")
    act_df.to_csv(act_path, index=False, encoding="utf-8-sig")
    print(f"✅ 今年のデータ保存完了: {act_path} （未来日は空欄で出力）")

    if get_avg_flag == "Y":
        start_year = target_year - 5
        end_year = target_year - 1
        print(f"⏳ 過去5年平均({start_year}〜{end_year}年)を取得中...")
        
        all_past_data = []
        for y in range(start_year, end_year + 1):
            print(f"  > {y}年のデータを取得中...")
            df_y = fetch_year_data(y, station_info, use_proxy)
            if not df_y.empty:
                all_past_data.append(df_y)
                
        if all_past_data:
            combined_past_df = pd.concat(all_past_data, ignore_index=True)
            avg_raw_df = combined_past_df.groupby("Date").mean().round(1).reset_index()
            
            avg_df = pd.merge(base_df, avg_raw_df, on="Date", how="left")
            avg_df = avg_df[["Date", "Temp", "Temp_max", "Temp_min", "precip"]]
            
            avg_path = os.path.join(out_dir, f"{city_name}{target_year}_avg.csv")
            avg_df.to_csv(avg_path, index=False, encoding="utf-8-sig")
            print(f"✅ 過去5年平均データ保存完了: {avg_path}")
        else:
            print("❌ 過去のデータが1件も取得できませんでした。")

def main():
    print("===================================================")
    print("  気象庁アメダス データ取得ツール (茨城県 水稲用)")
    print("===================================================\n")
    
    # --- ★追加：ネットワーク環境の選択 ---
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
        
    print(f"\n-> {'庁内ネットワーク (プロキシあり)' if use_proxy else '庁外ネットワーク (プロキシなし)'} で通信します。\n")
    # -----------------------------------

    while True:
        try:
            target_year = int(input("取得する西暦を入力してください (例: 2026): "))
            break
        except ValueError:
            print("※正しい数字で入力してください！")

    get_avg = input("\n過去5年間の平均値(avg)も取得しますか？ [Y/N] (EnterでY): ").strip().upper()
    if get_avg != "N":
        get_avg = "Y"

    print("\n=== 対象の観測所を選んでください ===")
    station_names = list(STATIONS.keys())
    for i, name in enumerate(station_names, 1):
        print(f" {i:2d} : {name}")
    print("===================================")

    while True:
        choice = input("番号を入力してください: ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(station_names):
            selected_city = station_names[int(choice) - 1]
            process_station(selected_city, target_year, get_avg, use_proxy)
            break
        else:
            print("※正しい番号を入力してください！")

if __name__ == "__main__":
    main()