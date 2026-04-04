import { useState } from 'react';
import { runPrediction } from '@/lib/logic/RicePredictor';
import { PredictionResult, GeoFeature, WeatherData } from '@/lib/logic/types';

interface UsePredictionProps {
    userDb: Record<string, any>;
    saveUserDb: (data: Record<string, any>) => Promise<void>;
    selectedDbName: string | null;
    fields: any; // geojsonData
    selectedFeatures: GeoFeature[];
    varieties: any[];
    loadedWeatherData: WeatherData[];
    setStatus: (s: string) => void;
    
    // Form States
    formVarietyId: string;
    formTransplantDate: string;
    formHeadingDate: string;
    formHeadingStatus?: string;
    formMeasurementDate?: string;
    formPanicleLength?: string;
}

// Utility function to sanitize and format date strings (e.g. MMDD -> MM-DD)
export const sanitizeInputDate = (d: string | null | undefined): string => {
    if (!d) return '';
    const s = String(d).trim().replace(/\//g, '-');
    
    // YYYY-MM-DD or YYYY-M-D
    let match = s.match(/^(\d{4})-?(\d{1,2})-?(\d{1,2})$/);
    if (match) {
        return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }
    
    // MM-DD or M-D
    match = s.match(/^(\d{1,2})-?(\d{1,2})$/);
    if (match) {
        return `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
    }
    
    // MMDD (4 digits)
    if (s.length === 4 && /^\d{4}$/.test(s)) {
        return `${s.substring(0, 2)}-${s.substring(2, 4)}`;
    }
    
    // YYYYMMDD (8 digits)
    if (s.length === 8 && /^\d{8}$/.test(s)) {
        return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    }
    
    // Invalid format
    return '';
};

export function usePrediction({
    userDb,
    saveUserDb,
    selectedDbName,
    fields,
    selectedFeatures,
    varieties,
    loadedWeatherData,
    setStatus,
    formVarietyId,
    formTransplantDate,
    formHeadingDate,
    formHeadingStatus,
    formMeasurementDate,
    formPanicleLength
}: UsePredictionProps) {
    const [calculationResult, setCalculationResult] = useState<PredictionResult | null>(null);

    const normalizeDate = (d: string) => {
        if (!d) return null;
        const s = sanitizeInputDate(d);
        if (s.match(/^\d{1,2}-\d{1,2}$/)) {
            const [m, day] = s.split('-');
            
            // Try to extract year from the first element of weather data if available
            let year = String(new Date().getFullYear());
            if (loadedWeatherData && loadedWeatherData.length > 0 && loadedWeatherData[0].date) {
                const wDateObj = new Date(loadedWeatherData[0].date);
                if (!isNaN(wDateObj.getFullYear())) {
                    year = String(wDateObj.getFullYear());
                }
            }
            return `${year}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return s; // Assume already YYYY-MM-DD
    };

    const formatUIDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const match = dateStr.match(/(?:^\d{4}-)?(\d{2}-\d{2})(?:T.*)?$/);
        if (match) return match[1];
        return String(dateStr);
    };

    const calculatePrediction = (): PredictionResult | null => {
        if (selectedFeatures.length !== 1) {
            alert("予測を実行する圃場を1つだけ選択してください。");
            return null;
        }
        return runPredictionForFeature(selectedFeatures[0]);
    };

    const runPredictionForFeature = (feature: GeoFeature): PredictionResult | null => {
        if (!loadedWeatherData.length) {
            return { error: 'No weather data loaded' } as any; 
        }
        
        const uuid = feature.properties.polygon_uuid || feature.properties.id;
        
        let varietyId = '';
        let transplantDate = '';
        let headingDate = '';
        let headingStatus = '';
        let measurementDate = '';
        let panicleLength: number | undefined = undefined;

        // Priority 1: If THIS feature is the one currently in the edit form, use form values
        const isSelected = selectedFeatures.length === 1 && (feature.properties.polygon_uuid === selectedFeatures[0].properties.polygon_uuid);
        if (isSelected) {
            varietyId = formVarietyId;
            transplantDate = formTransplantDate;
            headingDate = formHeadingDate;
            headingStatus = formHeadingStatus || '予測';
            measurementDate = formMeasurementDate || '';
            if (formPanicleLength) {
                const p = parseFloat(formPanicleLength);
                panicleLength = isNaN(p) ? undefined : p;
            }
        }

        // Priority 2: Use Database record to fill in what's missing, or for unselected features
        if (userDb[uuid]) {
            if (!varietyId) varietyId = userDb[uuid].varietyId;
            if (!transplantDate) transplantDate = userDb[uuid].transplantDate;
            if (!headingDate) headingDate = userDb[uuid].headingDate;
            if (!headingStatus) headingStatus = userDb[uuid].headingStatus || '予測';
            if (!measurementDate) measurementDate = userDb[uuid].measurementDate || '';
            if (panicleLength === undefined) panicleLength = userDb[uuid].panicleLength;
        }

        if (!headingStatus) headingStatus = '予測';

        if (!varietyId || (!transplantDate && !measurementDate && !headingDate)) {
            return { error: 'Missing variety or start date' } as any;
        }

        const variety = varieties.find(v => v.id === varietyId);
        if (!variety) return { error: 'Unknown variety' } as any;

        const normTransplant = normalizeDate(transplantDate);
        const normHeading = normalizeDate(headingDate);
        const normMeasurement = normalizeDate(measurementDate);

        if (!normTransplant && !normMeasurement && !normHeading) return { error: 'Invalid start date' } as any;

        // Preference: Heading (Actual) -> Measurement (Panicle) -> Transplant
        if (headingStatus === '実績' && normHeading) {
            return runPrediction(
                36.365,
                140.471,
                variety,
                loadedWeatherData,
                normHeading,
                'heading'
            );
        } else if (normMeasurement && panicleLength !== undefined) {
             return runPrediction(
                 36.365,
                 140.471,
                 variety,
                 loadedWeatherData,
                 normMeasurement,
                 'panicle',
                 panicleLength
             );
        } else if (normTransplant) {
            return runPrediction(
                36.365,
                140.471,
                variety,
                loadedWeatherData,
                normTransplant!,
                'transplant'
            );
        } else {
             return { error: 'Insufficient data for prediction' } as any;
        }
    };

    const handleBatchRepredict = async () => {
        if (!selectedDbName) {
            alert("まずは対象の保存先（Database）を選択してください。");
            return;
        }
        if (!loadedWeatherData.length) {
            alert("まずは気象データを選択・読み込んでください。");
            return;
        }

        setStatus('データベース上で一括再予測を実行しています...');
        const mergedData = { ...userDb };
        let updateCount = 0;

        if (!fields || !fields.features) {
            alert("圃場データ（GeoJSON）を読み込んでください。");
            return;
        }

        const featureMap = new Map<string, GeoFeature>();
        fields.features.forEach((f: GeoFeature) => {
             const uuid = f.properties.polygon_uuid || f.properties.id;
             featureMap.set(String(uuid), f);
        });

        for (const uuid of Object.keys(mergedData)) {
            const record = mergedData[uuid];
            
            if (record.maturityStatus === '実績') continue;

            const headingStatus = record.headingStatus || '予測';
            
            const feature = featureMap.get(String(uuid));
            if (!feature) continue;

            const res = runPredictionForFeature(feature);
            
            if (res && !res.error) {
                let updated = false;

                if (res.heading_date && headingStatus !== '実績') {
                    record.headingDate = res.heading_date;
                    record.headingStatus = '予測';
                    updated = true;
                }

                if (res.maturity_date) {
                    record.maturityDate = res.maturity_date;
                    record.maturityStatus = '予測';
                    updated = true;
                }

                if (res.met26 !== undefined && res.met26 !== null) {
                    record.met26 = res.met26;
                }

                if (updated) {
                    record.updatedAt = new Date().toISOString();
                    updateCount++;
                }
            }
        }

        if (updateCount > 0) {
            try {
                await saveUserDb(mergedData);
                setStatus(`再予測完了：${updateCount}件の圃場を更新しました。`);
                alert(`更新完了！ ${updateCount}件の圃場を再予測しました。`);
            } catch (e: any) {
                setStatus(`再予測の保存に失敗しました: ${e.message}`);
            }
        } else {
            setStatus('再予測必要な圃場がありませんでした（すべて実績、またはデータなし）。');
            alert('再予測が必要な圃場は見つかりませんでした。');
        }
    };

    return {
        calculationResult, setCalculationResult,
        normalizeDate,
        formatUIDate,
        calculatePrediction,
        runPredictionForFeature,
        handleBatchRepredict
    };
}
