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
    formTransplantDate
}: UsePredictionProps) {
    const [calculationResult, setCalculationResult] = useState<PredictionResult | null>(null);

    const normalizeDate = (d: string) => {
        if (!d) return null;
        if (d.match(/^\d{1,2}-\d{1,2}$/)) {
            const [m, day] = d.split('-');
            
            // Try to extract year from the first element of weather data if available
            let year = '2024';
            if (loadedWeatherData && loadedWeatherData.length > 0 && loadedWeatherData[0].date) {
                const wDateObj = new Date(loadedWeatherData[0].date);
                if (!isNaN(wDateObj.getFullYear())) {
                    year = String(wDateObj.getFullYear());
                }
            }
            return `${year}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return d; // Assume already YYYY-MM-DD
    };

    const formatUIDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '-';
        const match = dateStr.match(/(?:^\d{4}-)?(\d{2}-\d{2})(?:T.*)?$/);
        if (match) return match[1];
        return String(dateStr);
    };

    const calculatePrediction = (): PredictionResult | null => {
        if (selectedFeatures.length !== 1) {
            alert("Please select exactly one field for prediction.");
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

        if (userDb[uuid]) {
            varietyId = userDb[uuid].varietyId;
            transplantDate = userDb[uuid].transplantDate;
            headingDate = userDb[uuid].headingDate;
        }

        if (!varietyId || !transplantDate) {
            const formRec = selectedFeatures.length === 1 && (feature.properties.polygon_uuid === selectedFeatures[0].properties.polygon_uuid) 
              ? { varietyId: formVarietyId, transplantDate: formTransplantDate } : null;

            if (formRec && formRec.varietyId && formRec.transplantDate) {
               varietyId = formRec.varietyId;
               transplantDate = formRec.transplantDate;
            } else {
               return { error: 'Missing variety or transplant date' } as any;
            }
        }

        const variety = varieties.find(v => v.id === varietyId);
        if (!variety) return { error: 'Unknown variety' } as any;

        const normTransplant = normalizeDate(transplantDate);
        const normHeading = normalizeDate(headingDate);

        if (!normTransplant) return { error: 'Invalid transplant date' } as any;

        if (normHeading) {
            return runPrediction(
                36.365,
                140.471,
                variety,
                loadedWeatherData,
                normHeading,
                'heading'
            );
        } else {
            return runPrediction(
                36.365,
                140.471,
                variety,
                loadedWeatherData,
                normTransplant,
                'transplant'
            );
        }
    };

    const handleBatchRepredict = async () => {
        if (!selectedDbName) {
            alert("Please select a target database first.");
            return;
        }
        if (!loadedWeatherData.length) {
            alert("Please select and load Weather Data from the Main Map or Weather panel first.");
            return;
        }

        setStatus('Running batch re-prediction on database...');
        const mergedData = { ...userDb };
        let updateCount = 0;

        if (!fields || !fields.features) {
            alert("Please load City GeoJSON first so fields can be mapped.");
            return;
        }

        const featureMap = new Map<string, GeoFeature>();
        fields.features.forEach((f: GeoFeature) => {
             const uuid = f.properties.polygon_uuid || f.properties.id;
             featureMap.set(String(uuid), f);
        });

        for (const uuid of Object.keys(mergedData)) {
            const record = mergedData[uuid];
            const headingStatus = record.headingStatus || '実績';

            if (record.headingDate && headingStatus !== '予測' && record.maturityStatus !== '実績') {
                 const feature = featureMap.get(String(uuid));
                 if (feature) {
                     const res = runPredictionForFeature(feature);
                     if (res && !res.error && res.maturity_date) {
                         record.maturityDate = res.maturity_date;
                         record.maturityStatus = '予測';
                         record.updatedAt = new Date().toISOString();
                         updateCount++;
                     }
                 }
            }
        }

        if (updateCount > 0) {
            try {
                await saveUserDb(mergedData);
                setStatus(`Successfully re-predicted maturity dates for ${updateCount} fields.`);
                alert(`Update complete! ${updateCount} fields re-predicted.`);
            } catch (e: any) {
                setStatus(`Failed to save re-predictions: ${e.message}`);
            }
        } else {
            setStatus('No fields requiring re-prediction were found.');
            alert('No fields requiring re-prediction were found.');
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
