

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
    loadWeather
}: SetupPanelProps) {
    return (
        <div className="space-y-4">
            <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-green-800 mb-2">Database</label>
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
                    <option value="" disabled>-- Select DB --</option>
                    {dbList.map(db => (
                        <option key={db} value={db}>{db}</option>
                    ))}
                </select>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        placeholder="New DB Name"
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
                        Create
                    </button>
                </div>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Target City</label>
                <select 
                    className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                    value={selectedCity}
                    onChange={(e) => loadCity(e.target.value)}
                >
                    <option value="">-- Select City --</option>
                    {cityList.map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-sm font-bold text-gray-800 mb-1">Weather Point</label>
                <select 
                    className="w-full p-2 border border-gray-400 rounded text-black font-medium"
                    value={selectedWeatherPoint}
                    onChange={(e) => loadWeather(e.target.value)}
                >
                    <option value="">-- Select Weather --</option>
                    {weatherPoints.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
