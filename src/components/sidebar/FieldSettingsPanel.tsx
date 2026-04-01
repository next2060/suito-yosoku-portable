
import { GeoFeature, PredictionResult } from '@/lib/logic/types';
import { sanitizeInputDate } from '@/hooks/usePrediction';

interface FieldSettingsPanelProps {
    selectedFeatures: GeoFeature[];
    setSelectedFeatures: (features: GeoFeature[]) => void;
    calculationResult: PredictionResult | null;
    setCalculationResult: (res: PredictionResult | null) => void;
    setStatus: (s: string) => void;
    
    formFieldName: string;
    setFormFieldName: (s: string) => void;
    
    varieties: any[];
    formVarietyId: string;
    setFormVarietyId: (s: string) => void;
    
    formTransplantDate: string;
    setFormTransplantDate: (s: string) => void;
    
    formHeadingDate: string;
    setFormHeadingDate: (s: string) => void;
    formHeadingStatus: string;
    setFormHeadingStatus: (s: string) => void;
    
    formMaturityDate: string;
    setFormMaturityDate: (s: string) => void;
    formMaturityStatus: string;
    setFormMaturityStatus: (s: string) => void;
    
    selectedDbName: string | null;
    directoryHandle: FileSystemDirectoryHandle | null;
    
    calculatePrediction: () => PredictionResult | null;
    
    userDb: Record<string, any>;
    saveUserDb: (data: Record<string, any>) => Promise<void>;
    
    formatUIDate: (dateStr?: string) => string;
    onSelectAllSaved: () => void;
}

export default function FieldSettingsPanel({
    selectedFeatures,
    setSelectedFeatures,
    calculationResult,
    setCalculationResult,
    setStatus,
    
    formFieldName, setFormFieldName,
    varieties, formVarietyId, setFormVarietyId,
    formTransplantDate, setFormTransplantDate,
    formHeadingDate, setFormHeadingDate,
    formHeadingStatus, setFormHeadingStatus,
    formMaturityDate, setFormMaturityDate,
    formMaturityStatus, setFormMaturityStatus,
    
    selectedDbName,
    directoryHandle,
    
    calculatePrediction,
    
    userDb,
    saveUserDb,
    
    formatUIDate,
    onSelectAllSaved
}: FieldSettingsPanelProps) {
    if (selectedFeatures.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50 border-2 border-dashed border-gray-200 rounded min-h-[300px] p-4">
                <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="font-bold mb-2">No Field Selected</p>
                <p className="text-xs mt-1 text-center px-4 mb-4">Click fields on the map to edit settings or view predictions.</p>
                {Object.keys(userDb).length > 0 && (
                    <button 
                        onClick={onSelectAllSaved} 
                        className="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded transition shadow-sm"
                    >
                        Select All Saved Fields ({Object.keys(userDb).length})
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white p-4 rounded shadow border border-gray-200">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-lg text-green-800">
                    {selectedFeatures.length > 1 ? `Batch Settings (${selectedFeatures.length})` : 'Field Settings'}
                </h3>
                <div className="flex gap-2">
                    {Object.keys(userDb).length > 0 && (
                        <button 
                            onClick={onSelectAllSaved}
                            className="px-2 py-1 bg-green-50 hover:bg-green-100 text-[10px] text-green-700 font-bold rounded border border-green-200"
                        >
                            Select All
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            setSelectedFeatures([]);
                            setCalculationResult(null);
                        }}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-[10px] text-gray-700 font-bold rounded border border-gray-300"
                    >
                        Clear
                    </button>
                </div>
            </div>
            {selectedFeatures.length === 1 && (
                <p className="text-xs text-gray-700 mb-2 font-mono font-bold">
                    {selectedFeatures[0].properties.polygon_uuid}
                </p>
            )}
            <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                <h4 className="font-bold text-sm text-green-800 mb-2 border-b pb-1">Field Data</h4>
                <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">Field Name <span className="text-gray-400 text-[10px]">(Optional)</span></label>
                    <input 
                        type="text" 
                        placeholder="Field Name"
                        className="w-full p-2 border border-gray-400 rounded text-sm text-black font-medium"
                        value={formFieldName}
                        onChange={(e) => setFormFieldName(e.target.value)}
                    />
                </div>
            </div>
            
            <div className="space-y-3 mt-3">
                <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">Variety <span className="text-gray-400 text-[10px]">(Optional)</span></label>
                    <select 
                        className="w-full p-2 border border-gray-400 rounded text-sm text-black font-medium"
                        value={formVarietyId}
                        onChange={(e) => setFormVarietyId(e.target.value)}
                    >
                        <option value="">-- Select Variety --</option>
                        {varieties.map(v => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">
                        Transplant Date (MM-DD) <span className="text-gray-400 text-[10px]">(Optional)</span>
                    </label>
                    <input 
                        type="text" 
                        placeholder="MM-DD (Optional)"
                        className="w-full p-2 border border-gray-400 rounded text-sm text-black font-medium"
                        value={formTransplantDate}
                        onChange={(e) => setFormTransplantDate(e.target.value)}
                    />
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">
                        Heading Date (MM-DD) <span className="text-gray-400 text-[10px]">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="MM-DD (Optional)"
                            className="w-2/3 p-2 border border-gray-400 rounded text-sm text-black font-medium"
                            value={formHeadingDate}
                            onChange={(e) => setFormHeadingDate(e.target.value)}
                        />
                        <select
                            className="w-1/3 p-2 border border-gray-400 rounded text-sm text-black font-medium"
                            value={formHeadingStatus}
                            onChange={(e) => setFormHeadingStatus(e.target.value)}
                        >
                            <option value="">(None)</option>
                            <option value="実績">実績</option>
                            <option value="予測">予測</option>
                        </select>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1 mb-2">
                        If entered, prediction starts from Heading Date.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">
                        Maturity Date (MM-DD) <span className="text-gray-400 text-[10px]">(Optional)</span>
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="MM-DD (Optional)"
                            className="w-2/3 p-2 border border-gray-400 rounded text-sm text-black font-medium"
                            value={formMaturityDate}
                            onChange={(e) => setFormMaturityDate(e.target.value)}
                        />
                        <select
                            className="w-1/3 p-2 border border-gray-400 rounded text-sm text-black font-medium"
                            value={formMaturityStatus}
                            onChange={(e) => setFormMaturityStatus(e.target.value)}
                        >
                            <option value="">(None)</option>
                            <option value="実績">実績</option>
                            <option value="予測">予測</option>
                        </select>
                    </div>
                </div>

                {selectedFeatures.length > 1 && (
                    <div className="bg-amber-50 border border-amber-300 rounded p-2 mt-2">
                        <p className="text-[11px] text-amber-800 font-medium">
                            ⚠ 複数選択モード: 空欄のフィールドは既存データを維持します。入力した項目のみ一括で上書きされます。
                        </p>
                    </div>
                )}

                <div className="flex flex-col gap-2 mt-4">
                    <button 
                        onClick={() => {
                            // RUN: Only works for single selection
                            const result = calculatePrediction();
                            if (result) {
                                setCalculationResult(result);
                                setStatus('Calculation completed.');
                            }
                        }}
                        disabled={selectedFeatures.length > 1 || !selectedDbName}
                        className={`w-full text-white font-bold py-2 rounded transition ${selectedFeatures.length > 1 || !selectedDbName ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        RUN
                    </button>
                    <div className="flex gap-2">
                        <button 
                            onClick={async () => {
                                // SAVE: Save only non-empty fields to DB
                                if (selectedFeatures.length > 0 && directoryHandle && selectedDbName) {
                                    // Update DB for ALL selected features
                                    const newData = { ...userDb };
                                    
                                    const safeTransplant = sanitizeInputDate(formTransplantDate);
                                    const safeHeading = sanitizeInputDate(formHeadingDate);
                                    const safeMaturity = sanitizeInputDate(formMaturityDate);
                                    
                                    if (selectedFeatures.length === 1) {
                                        setFormTransplantDate(safeTransplant);
                                        setFormHeadingDate(safeHeading);
                                        setFormMaturityDate(safeMaturity);
                                    }
                                    
                                    selectedFeatures.forEach(feature => {
                                        const uuid = feature.properties.polygon_uuid || feature.properties.id;
                                        const existingRecord = newData[uuid] || {};
                                        
                                        // Build updates with only non-empty fields
                                        const updates: Record<string, any> = {
                                            id: String(uuid),
                                            updatedAt: new Date().toISOString()
                                        };
                                        
                                        if (formFieldName)       updates.name = formFieldName;
                                        if (formVarietyId)       updates.varietyId = formVarietyId;
                                        if (safeTransplant)      updates.transplantDate = safeTransplant;
                                        if (safeHeading)         updates.headingDate = safeHeading;
                                        if (formHeadingStatus)   updates.headingStatus = formHeadingStatus;
                                        if (safeMaturity)        updates.maturityDate = safeMaturity;
                                        if (formMaturityStatus)  updates.maturityStatus = formMaturityStatus;
                                        
                                        newData[uuid] = { ...existingRecord, ...updates };
                                    });
                                    
                                    try {
                                        await saveUserDb(newData);
                                        setStatus(`Saved settings for ${selectedFeatures.length} fields.`);
                                        setSelectedFeatures([]); // Cancel selection
                                    } catch (e: any) {
                                        setStatus(`Error saving: ${e.message}`);
                                    }
                                }
                            }}
                            disabled={!selectedDbName}
                            className={`flex-1 font-bold py-2 rounded transition ${!selectedDbName ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                        >
                            SAVE
                        </button>
                        <button 
                            onClick={async () => {
                                // DELETE: Remove from DB (Batch)
                                if (selectedFeatures.length > 0 && directoryHandle && selectedDbName) {
                                    const confirmMsg = selectedFeatures.length > 1 
                                        ? `本当に選択した ${selectedFeatures.length} 件の圃場データを削除しますか？`
                                        : '本当にこの圃場データを削除しますか？';
                                    
                                    if (!window.confirm(confirmMsg)) {
                                        return;
                                    }

                                    const newData = { ...userDb };
                                    let deletedCount = 0;
                                    selectedFeatures.forEach(feature => {
                                        const uuid = feature.properties.polygon_uuid || feature.properties.id;
                                        if (newData[uuid]) {
                                            delete newData[uuid];
                                            deletedCount++;
                                        }
                                    });
                                    if (deletedCount > 0) {
                                        try {
                                            await saveUserDb(newData);
                                            setStatus(`Deleted settings for ${deletedCount} fields.`);
                                            if (selectedFeatures.length === 1) {
                                                setFormFieldName('');
                                                setFormVarietyId('');
                                                setFormTransplantDate('');
                                                setFormHeadingDate('');
                                                setFormMaturityDate('');
                                            }
                                            setSelectedFeatures([]); // Cancel selection
                                        } catch (e: any) {
                                            setStatus(`Error deleting: ${e.message}`);
                                        }
                                    } else {
                                        setStatus('No saved records found to delete.');
                                    }
                                }
                            }}
                            disabled={!selectedDbName}
                            className={`flex-1 font-bold py-2 rounded transition ${!selectedDbName ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        >
                            DELETE
                        </button>
                    </div>
                </div>
            </div>

            {calculationResult && selectedFeatures.length === 1 && (
                <div className="mt-4 pt-4 border-t border-gray-100 bg-green-50 rounded p-2">
                    <h4 className="font-bold text-sm text-green-900 mb-2">Prediction Result</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-gray-800 font-semibold">Heading:</div>
                        <div className="font-bold text-black">{formatUIDate(calculationResult.heading_date || undefined)}</div>
                        <div className="text-gray-800 font-semibold">Maturity:</div>
                        <div className="font-bold text-black">{formatUIDate(calculationResult.maturity_date || undefined)}</div>
                        {calculationResult.met26 !== undefined && (
                            <>
                                <div className="text-gray-800 font-semibold">MET26:</div>
                                <div className="font-bold text-black">{calculationResult.met26?.toFixed(1) ?? '-'}</div>
                            </>
                        )}
                    </div>
                    {calculationResult.error && (
                        <div className="text-red-500 text-xs mt-2">{calculationResult.error}</div>
                    )}
                </div>
            )}
        </div>
    );
}
