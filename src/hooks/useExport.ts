import { useState } from 'react';
import { GeoFeature, PredictionResult, WeatherData } from '@/lib/logic/types';
import {
    formatMainExportData,
    createGeoJsonFromFormattedData,
    getChoroplethOptions
} from '@/lib/export_utils';
import { MAP_TEMPLATE_HTML } from '@/lib/map_template';

interface UseExportProps {
    userDb: Record<string, any>;
    saveUserDb: (data: Record<string, any>) => Promise<void>;
    selectedDbName: string | null;
    fields: any; // geojson
    selectedFeatures: GeoFeature[];
    varieties: any[];
    loadedWeatherData: WeatherData[];
    setStatus: (s: string) => void;
    runPredictionForFeature: (feature: GeoFeature) => PredictionResult | null;
}

export function useExport({
    userDb,
    saveUserDb,
    selectedDbName,
    fields,
    selectedFeatures,
    varieties,
    loadedWeatherData,
    setStatus,
    runPredictionForFeature
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
        if (!loadedWeatherData.length) {
            alert("Please select weather data first.");
            return null;
        }
  
        setIsExporting(true);
        setStatus('Running predictions for export...');
        
        // Run predictions
        const results = new Map<string, any>(); // PredictionResult
        
        for (const feature of targetFeatures) {
            const uuid = feature.properties.polygon_uuid || feature.properties.id;
            const res = runPredictionForFeature(feature);
            if (res) {
                results.set(uuid, res);
            }
        }
  
        // Automatically save predicted dates to the database
        let exportDb = userDb;
        if (selectedDbName) {
            const mergedData = { ...userDb };
            let hasChanges = false;
            
            results.forEach((res, uuid) => {
                if (res && !res.error && mergedData[uuid]) {
                    const record = mergedData[uuid];
                    let updated = false;
  
                    if (!record.headingDate && res.heading_date) {
                        record.headingDate = res.heading_date;
                        record.headingStatus = '予測';
                        updated = true;
                    }
  
                    if (!record.maturityDate && res.maturity_date) {
                        record.maturityDate = res.maturity_date;
                        record.maturityStatus = '予測';
                        updated = true;
                    }
  
                    if (updated) {
                        record.updatedAt = new Date().toISOString();
                        hasChanges = true;
                    }
                }
            });
  
            if (hasChanges) {
                try {
                    await saveUserDb(mergedData);
                } catch (e: any) {
                    console.error("Failed to auto-save predictions to DB:", e);
                }
            }
            exportDb = mergedData;
        }
  
        // Format
        const formatted = await formatMainExportData(
            'rice',
            targetFeatures,
            exportDb,
            results
        );
        
        setIsExporting(false);
        setStatus(`Export ready for ${targetFeatures.length} fields.`);
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
            alert("No saved fields found to export.");
            return;
        }
        const data = await prepareExportData(targets);
        if (!data) return;
  
        const headers = Object.keys(data[0]);
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
            alert("No saved fields found to export.");
            return;
        }
        const data = await prepareExportData(targets); // Formatted rows
        if (!data) return;
  
        const geoJson = createGeoJsonFromFormattedData(data, targets);
        const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: 'application/json' });
        downloadFile(blob, getExportFileName('geojson'));
    };
  
    const handleHtmlExport = async () => {
        const targets = getTargetFeatures();
        if (targets.length === 0) {
            alert("No saved fields found to export.");
            return;
        }
        
        const data = await prepareExportData(targets);
        if (!data) return;
  
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
            alert("Failed to generate map: " + e.message);
        }
    };

    return {
        isExporting,
        handleCsvExport,
        handleGeoJsonExport,
        handleHtmlExport
    };
}
