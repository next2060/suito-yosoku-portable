import { useState } from 'react';
import { GeoFeature } from '@/lib/logic/types';
import {
    formatMainExportData,
    createGeoJsonFromFormattedData,
    getChoroplethOptions
} from '@/lib/export_utils';
import { MAP_TEMPLATE_HTML } from '@/lib/map_template';

interface UseExportProps {
    userDb: Record<string, any>;
    selectedDbName: string | null;
    fields: any; // geojson
    selectedFeatures: GeoFeature[];
    varieties: any[];
    setStatus: (s: string) => void;
}

export function useExport({
    userDb,
    selectedDbName,
    fields,
    selectedFeatures,
    varieties,
    setStatus,
}: UseExportProps) {
    const [isExporting, setIsExporting] = useState(false);

    // Helper for download
    const downloadFile = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const prepareExportData = async (targetFeatures: GeoFeature[]) => {
        setIsExporting(true);
        setStatus('DBから出力データを準備中...');
        
        // Read directly from DB — no prediction calculation
        const formatted = await formatMainExportData(
            'rice',
            targetFeatures,
            userDb,
        );
        
        setIsExporting(false);
        setStatus(`${targetFeatures.length}件の圃場の出力準備が完了しました。`);
        return formatted;
    };
  
    const getTargetFeatures = () => {
        if (selectedFeatures.length > 0) {
            return selectedFeatures;
        } else if (fields && fields.features) {
            return fields.features.filter((f: any) => {
                const uuid = f.properties.polygon_uuid || f.properties.id;
                return !!userDb[uuid];
            });
        }
        return [];
    };
  
    const getExportFileName = (ext: string) => {
        const d = new Date();
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const prefix = selectedDbName || 'export';
        return `${prefix}_${yy}${mm}${dd}.${ext}`;
    };
  
    const handleCsvExport = async () => {
        const targets = getTargetFeatures();
        if (targets.length === 0) {
            alert("出力する保存済みデータが見つかりません。");
            return;
        }
        const data = await prepareExportData(targets);
        if (!data || data.length === 0) return;
  
        // Define fixed headers in the requested order
        const headers = [
            'ポリゴンUUID',
            '圃場名',
            '品種',
            '移植期',
            '測定日',
            '幼穂長',
            '出穂期',
            '出穂期_状態',
            '成熟期',
            '成熟期_状態',
            'MET26',
            '緯度',
            '経度',
            '市町村コード',
            '備考',
            'エラー'
        ];

        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(fieldName => {
              const val = row[fieldName as keyof typeof row];
              return JSON.stringify(val === null || val === undefined ? '' : val);
          }).join(','))
        ].join('\r\n');
  
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadFile(blob, getExportFileName('csv'));
    };
  
    const handleGeoJsonExport = async () => {
        const targets = getTargetFeatures();
        if (targets.length === 0) {
            alert("出力する保存済みデータが見つかりません。");
            return;
        }
        const data = await prepareExportData(targets);
        if (!data || data.length === 0) return;
  
        const geoJson = createGeoJsonFromFormattedData(data, targets);
        const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
        downloadFile(blob, getExportFileName('geojson'));
    };
  
    const handleHtmlExport = async () => {
        const targets = getTargetFeatures();
        if (targets.length === 0) {
            alert("出力する保存済みデータが見つかりません。");
            return;
        }
        
        const data = await prepareExportData(targets);
        if (!data || data.length === 0) return;
  
        const geoJson = createGeoJsonFromFormattedData(data, targets);
        
        const varietyColors: Record<string, string> = {};
        varieties.forEach(v => {
            if (v.name && v.color) {
                varietyColors[v.name] = v.color;
            }
        });
        
        const choroplethOptions = getChoroplethOptions('rice');
  
        try {
            const html = MAP_TEMPLATE_HTML
              .replace('__GEOJSON_DATA__', JSON.stringify(geoJson))
              .replace('__VARIETY_COLORS__', JSON.stringify(varietyColors))
              .replace('__CHOROPLETH_OPTIONS__', JSON.stringify(choroplethOptions));
            
            const blob = new Blob([html], { type: 'text/html' });
            downloadFile(blob, getExportFileName('html'));
        } catch (e: any) {
            alert("マップの生成に失敗しました: " + e.message);
        }
    };

    return {
        isExporting,
        handleCsvExport,
        handleGeoJsonExport,
        handleHtmlExport
    };
}
