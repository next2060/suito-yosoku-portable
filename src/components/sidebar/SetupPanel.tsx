

interface SetupPanelProps {
    dbList: string[];
    selectedDbName: string | null;
    loadUserDb: (name: string) => Promise<void>;
    setSelectedFeatures: (features: any[]) => void;
    setCalculationResult: (res: any) => void;
    
    newDbName: string;
    setNewDbName: (name: string) => void;
    createNewDb: (name: string) => Promise<void>;

    cityList: string[];
    selectedCity: string;
    loadCity: (name: string) => Promise<void>;

    weatherPoints: string[];
    selectedWeatherPoint: string;
    loadWeather: (name: string) => Promise<void>;

    onBatchRepredict?: () => void;
    hasWeatherLoaded?: boolean;
}

export default function SetupPanel({
    dbList,
    selectedDbName,
    loadUserDb,
    setSelectedFeatures,
    setCalculationResult,
    newDbName,
    setNewDbName,
    createNewDb,
    cityList,
    selectedCity,
    loadCity,
    weatherPoints,
    selectedWeatherPoint,
    loadWeather,
    onBatchRepredict,
    hasWeatherLoaded
}: SetupPanelProps) {
    return (
        <div className="space-y-4">
            <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-green-800 mb-2">保存先 Database</label>
                <select 
                    className="w-full p-2 border border-gray-400 rounded text-black font-medium mb-2 bg-gray-50"
                    value={selectedDbName || ''}
                    onChange={(e) => {
                        if (e.target.value) {
                            loadUserDb(e.target.value).catch(console.error);
                            setSelectedFeatures([]);
                            setCalculationResult(null);
                        }
                    }}
                >
                    <option value="">-- DBを選択 --</option>
                    {dbList.map(db => (
                        <option key={db} value={db}>{db}</option>
                    ))}
                </select>
                <label className="block text-xs font-bold text-gray-700 mt-3 mb-1">新規作成</label>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        placeholder="DB名"
                        className="flex-1 p-1 text-sm border border-gray-400 rounded text-black"
                        value={newDbName}
                        onChange={(e) => setNewDbName(e.target.value)}
                    />
                    <button 
                        onClick={() => {
                            if (newDbName.trim()) {
                                createNewDb(newDbName.trim()).catch(console.error);
                                setNewDbName('');
                                setSelectedFeatures([]);
                                setCalculationResult(null);
                            }
                        }}
                        disabled={!newDbName.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded disabled:opacity-50"
                    >
                        作成
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">対象の市町村</label>
                <select 
                    className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                    value={selectedCity}
                    onChange={(e) => loadCity(e.target.value)}
                >
                    <option value="">-- 市町村を選択 --</option>
                    {cityList.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">気象データ</label>
                <select 
                    className="w-full p-2 border border-gray-400 rounded text-black font-medium mb-4"
                    value={selectedWeatherPoint}
                    onChange={(e) => loadWeather(e.target.value)}
                >
                    <option value="">-- 気象データを選択 --</option>
                    {weatherPoints.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>

                {onBatchRepredict && (
                    <div className="border-t border-gray-300 pt-4 mt-2">
                         <button
                             onClick={onBatchRepredict}
                             disabled={!hasWeatherLoaded}
                             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded disabled:bg-gray-400 transition"
                         >
                             一括再予測<br/><span className="text-[10px] opacity-80">※気象データの読み込みが必要です</span>
                         </button>
                         {!hasWeatherLoaded && (
                             <p className="text-[10px] text-red-500 mt-1 font-bold">
                                 ※気象データが読み込まれていません
                             </p>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
}
