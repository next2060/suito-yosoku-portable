import { useState, useRef, useEffect } from 'react';
import { useFileSystemContext } from '@/contexts/FileSystemContext';
import { GeoFeature } from '@/lib/logic/types';
import Papa from 'papaparse';
import { sanitizeInputDate } from '@/hooks/usePrediction';

import MapComponent from '@/components/MapComponent';

interface CsvImportProps {
    onBatchRepredict?: () => void;
    hasWeatherLoaded?: boolean;
    weatherPoints?: string[];
    selectedWeatherPoint?: string;
    loadWeather?: (pointName: string) => Promise<void>;
    globalSelectedCity?: string;
    globalLoadCity?: (cityName: string) => Promise<void>;
    globalFields?: any;
}

export default function CsvImport({ 
    onBatchRepredict, 
    hasWeatherLoaded,
    weatherPoints = [],
    selectedWeatherPoint = '',
    loadWeather,
    globalSelectedCity,
    globalLoadCity,
    globalFields
}: CsvImportProps) {
    const { 
        directoryHandle, 
        cityList, 
        varieties, 
        dbList,
        selectedDbName,
        userDb,
        loadUserDb,
        saveUserDb,
        statusMessage: contextStatus
    } = useFileSystemContext();

    const [status, setStatus] = useState<string>('');

    const [matchedFields, setMatchedFields] = useState<any>(null); // Filtered GeoJSON
    const [tempUserDb, setTempUserDb] = useState<any>({}); // Mapped for MapComponent
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync status
    useEffect(() => {
        if (contextStatus) setStatus(contextStatus);
    }, [contextStatus]);

    // --- Data Loading ---
    const handleCityChange = async (cityName: string) => {
        if (!directoryHandle || !globalLoadCity) return;
        try {
            await globalLoadCity(cityName);
            
            // Reset state
            setMatchedFields(null);
            setTempUserDb({});
            if (fileInputRef.current) fileInputRef.current.value = '';

            setStatus(`Loaded ${cityName}. Select DB and upload CSV.`);
        } catch (e: any) {
            setStatus(`Error loading city: ${e.message}`);
        }
    };


    // --- CSV Handling ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!globalSelectedCity || !globalFields || !selectedDbName) {
            alert("Please select a city and Target DB first.");
            return;
        }

        setStatus('Parsing CSV...');
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    setStatus(`CSV Error: ${results.errors[0].message}`);
                    return;
                }
                processCsvData(results.data);
            }
        });
    };

    const processCsvData = (data: any[]) => {
        // Expected columns: polygon_uuid, variety, transplant_date, heading_date (optional)
        
        const validRows: any[] = [];
        const newTempDb: any = {};
        const matchedFeatures: GeoFeature[] = [];

        // 1. Create Lookup for Features
        const featureMap = new Map<string, GeoFeature>();
        if (globalFields?.features) {
            globalFields.features.forEach((f: GeoFeature) => {
                 const uuid = f.properties.polygon_uuid || f.properties.id;
                 featureMap.set(String(uuid), f);
            });
        }

        // DEBUG: Log GeoJSON feature keys and CSV row keys
        const featureKeys = Array.from(featureMap.keys());
        console.log(`[CSV Import Debug] GeoJSON features count: ${featureKeys.length}`);
        console.log(`[CSV Import Debug] Sample GeoJSON UUIDs (first 5):`, featureKeys.slice(0, 5));
        console.log(`[CSV Import Debug] CSV rows count: ${data.length}`);
        if (data.length > 0) {
            console.log(`[CSV Import Debug] CSV columns:`, Object.keys(data[0]));
            console.log(`[CSV Import Debug] First CSV row:`, data[0]);
            // Try all possible UUID column names
            const csvUuid = data[0]['polygon_uuid'] || data[0]['id'] || data[0]['fid'];
            console.log(`[CSV Import Debug] First CSV UUID (polygon_uuid|id|fid):`, csvUuid);
        }

        // 2. Iterate CSV - try multiple possible column names for UUID
        let matchCount = 0;
        data.forEach((row: any) => {
            const uuid = row['ポリゴンUUID'] || row['polygon_uuid'] || row['id'] || row['fid'];
            if (!uuid) return;

            const feature = featureMap.get(String(uuid));
            if (feature) {
                matchCount++;
                validRows.push(row);
                matchedFeatures.push(feature);

                // Find Variety ID
                const varietyInput = row['varietyId'] || row['variety'] || row['品種'];
                const variety = varieties.find(v => v.name === varietyInput || v.id === varietyInput);
                const varietyId = variety ? variety.id : '';

                // Date Formatting (Supporting both English tags and Japanese tags)
                let transplantDate = row['transplantDate'] ?? row['transplant_date'] ?? row['移植期'] ?? row['移植日'] ?? '';
                let headingDate = row['headingDate'] ?? row['heading_date'] ?? row['出穂期'] ?? '';
                let maturityDate = row['maturityDate'] ?? row['maturity_date'] ?? row['成熟期'] ?? '';
                let measurementDate = row['measurementDate'] ?? row['measurement_date'] ?? row['測定日'] ?? '';
                let panicleLength = row['panicleLength'] ?? row['panicle_length'] ?? row['幼穂長'] ?? '';
                const fieldName = row['name'] ?? row['field_name'] ?? row['圃場名'] ?? '';
                
                // Get explicit status
                let headingStatus = row['headingStatus'] ?? row['heading_status'] ?? row['出穂期_状態'];
                let maturityStatus = row['maturityStatus'] ?? row['maturity_status'] ?? row['成熟期_状態'];

                // CSV Sanitization: Prevent saving error messages or invalid strings mapped to dates
                transplantDate = sanitizeInputDate(transplantDate);
                headingDate = sanitizeInputDate(headingDate);
                maturityDate = sanitizeInputDate(maturityDate);
                measurementDate = sanitizeInputDate(measurementDate);
                let parsedPanicle = panicleLength ? parseFloat(panicleLength) : undefined;
                if (parsedPanicle && isNaN(parsedPanicle)) parsedPanicle = undefined;

                // Sanitize Status
                const isValidStatus = (s: any) => s === '予測' || s === '実績' ? s : undefined;
                headingStatus = isValidStatus(headingStatus);
                maturityStatus = isValidStatus(maturityStatus);

                newTempDb[String(uuid)] = {
                    id: String(uuid),
                    name: fieldName || undefined,
                    varietyId: varietyId,
                    transplantDate: transplantDate,
                    headingDate: headingDate,
                    maturityDate: maturityDate,
                    measurementDate: measurementDate,
                    panicleLength: parsedPanicle,
                    headingStatus: headingStatus,
                    maturityStatus: maturityStatus,
                    updatedAt: new Date().toISOString()
                };
            }
        });

        console.log(`[CSV Import Debug] Matched ${matchCount} out of ${data.length} CSV rows`);

        setTempUserDb(newTempDb);
        setMatchedFields({
            type: "FeatureCollection",
            features: matchedFeatures
        });

        setStatus(`Loaded CSV. Matched ${matchCount} / ${data.length} fields.`);
    };

    // --- Bulk Save ---
    const handleSaveToDb = async () => {
        if (!selectedDbName || !matchedFields) {
            alert("Please select Target DB and matched fields to save.");
            return;
        }

        try {
            const mergedData = { ...userDb, ...tempUserDb };
            await saveUserDb(mergedData);
            setStatus(`Saved ${Object.keys(tempUserDb).length} fields to ${selectedDbName}. The map will continue to show these fields.`);
            
        } catch (e: any) {
            setStatus(`Error saving to DB: ${e.message}`);
        }
    };

    if (!directoryHandle) {
         return (
             <div className="p-8 text-center">
                 <p className="text-red-600 font-bold">Please select a data folder on the main page first.</p>
             </div>
         );
    }

    return (
        <div className="flex w-full h-full">
            {/* Sidebar */}
            <aside className="w-80 bg-gray-50 p-4 border-r border-gray-300 flex flex-col gap-4 overflow-y-auto h-full">
                 <div className="bg-blue-50 text-blue-800 p-2 rounded text-xs">{status}</div>

                     {/* 1. City Select */}
                     <div>
                        <label className="block text-sm font-bold text-black mb-1">1. Select City</label>
                        <select 
                            className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                            value={globalSelectedCity || ''}
                            onChange={(e) => handleCityChange(e.target.value)}
                        >
                            <option value="">-- Select City --</option>
                            {cityList.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. DB Select */}
                    <div>
                        <label className="block text-sm font-bold text-black mb-1">2. Target DB</label>
                        <select 
                            className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                            value={selectedDbName || ''}
                            onChange={async (e) => {
                                if (e.target.value) {
                                    try {
                                        await loadUserDb(e.target.value);
                                        // Reset temp on DB switch
                                        setMatchedFields(null);
                                        setTempUserDb({});
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }
                            }}
                        >
                            <option value="" disabled>-- Select DB --</option>
                            {dbList.map(db => (
                                <option key={db} value={db}>{db}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. CSV Upload */}
                    <div>
                        <label className="block text-sm font-bold text-black mb-1">3. Upload CSV</label>
                        <input 
                            type="file" 
                            accept=".csv"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="w-full text-sm"
                            disabled={!globalSelectedCity || !selectedDbName}
                        />
                        <p className="text-[10px] text-gray-600 mt-1">
                            Supported cols: id, name, varietyId, transplantDate, headingDate, headingStatus, maturityDate, maturityStatus
                        </p>
                    </div>

                    {/* 4. Save */}
                    <button 
                        onClick={handleSaveToDb}
                        disabled={!matchedFields || !selectedDbName}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded disabled:bg-gray-400"
                    >
                        Save To DB
                    </button>

                    {/* 5. Weather Select & Batch Re-prediction */}
                    {onBatchRepredict && (
                         <div className="mt-4 border-t border-gray-300 pt-4">
                             {/* Weather Selection */}
                             <div className="mb-4">
                                 <label className="block text-sm font-bold text-black mb-1">Select Weather Data</label>
                                 <select 
                                     className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                                     value={selectedWeatherPoint}
                                     onChange={(e) => {
                                         if (loadWeather) loadWeather(e.target.value);
                                     }}
                                 >
                                     <option value="">-- Select Weather --</option>
                                     {weatherPoints.map(wp => (
                                         <option key={wp} value={wp}>{wp}</option>
                                     ))}
                                 </select>
                             </div>

                             <button
                                 onClick={onBatchRepredict}
                                 disabled={!hasWeatherLoaded}
                                 className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded disabled:bg-gray-400 transition"
                             >
                                 Re-Prediction (All)<br/><span className="text-[10px] opacity-80">Requires Weather Data</span>
                             </button>
                             {!hasWeatherLoaded && (
                                 <p className="text-[10px] text-red-500 mt-1 font-bold">
                                     Please select weather data above.
                                 </p>
                             )}
                         </div>
                    )}
                </aside>

                <div className="flex-1 relative bg-gray-200">
                    <MapComponent 
                        geojsonData={matchedFields} 
                        onFeatureSelect={(f) => {
                             // Display info? For now just log or simplified
                             console.log(f.properties);
                        }}
                        selectedFeatureIds={[]}
                        userDb={matchedFields ? tempUserDb : {}}
                        varieties={varieties}
                    />
                    {matchedFields && (
                        <div className="absolute top-4 right-4 bg-white p-2 rounded shadow z-[1000] text-sm">
                            Showing {matchedFields.features.length} matched fields
                        </div>
                    )}
                </div>
        </div>
    );
}
