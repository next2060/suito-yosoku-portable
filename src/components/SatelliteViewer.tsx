import { useState, useEffect } from 'react';
import { useFileSystemContext } from '../contexts/FileSystemContext';
import SatelliteMap from './SatelliteMap';

export default function SatelliteViewer() {
    const { 
        scanAvailableSatelliteDates, 
        loadSatelliteJson, 
        loadSatelliteTiff,
        loadCityGeoJson,
        scanAvailableSatelliteCities,
        scanAvailableSatelliteUsers,
        userDb,
        varieties,
        selectedDbName,
        loadUserDb
    } = useFileSystemContext();

    const [activeTab, setActiveTab] = useState<'NDVI' | 'Flooded' | 'TrueColor'>('NDVI');
    const [floodedSubMode, setFloodedSubMode] = useState<'Flooded' | 'SAR_Flooded'>('Flooded');
    const [availableCities, setAvailableCities] = useState<string[]>([]);
    const [selectedCity, setSelectedCity] = useState<string>('');
    const [availableDbs, setAvailableDbs] = useState<string[]>([]);
    const [selectedDb, setSelectedDb] = useState<string>(selectedDbName || '');
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [satelliteData, setSatelliteData] = useState<any | null>(null);
    const [tiffBuffer, setTiffBuffer] = useState<ArrayBuffer | null>(null);

    const [status, setStatus] = useState<string>('地域と日付を選択してください。');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    // Filter fields geojson by selected city
    const [cityGeoJson, setCityGeoJson] = useState<any>(null);

    // effectiveMode resolves the actual directory/file prefix for data loading
    const effectiveMode = activeTab === 'Flooded' ? floodedSubMode : activeTab;
    const needsDb = activeTab === 'NDVI' || activeTab === 'TrueColor';

    // Sync selectedDb with global state initially or load if changed
    useEffect(() => {
        if (selectedDb && selectedDb !== selectedDbName && needsDb) {
            loadUserDb(selectedDb).catch(console.error);
        }
    }, [selectedDb, selectedDbName, loadUserDb, needsDb]);

    // Update available cities when tab changes
    useEffect(() => {
        const fetchCities = async () => {
            if (activeTab) {
                try {
                    const cities = await scanAvailableSatelliteCities(effectiveMode);
                    setAvailableCities(cities);
                    // auto select first city if current isn't valid or empty
                    if (cities.length > 0 && !cities.includes(selectedCity)) {
                        setSelectedCity(cities[0]);
                    } else if (cities.length === 0) {
                        setSelectedCity('');
                        setCityGeoJson(null);
                        setSatelliteData(null);
                        setTiffBuffer(null);
                        setStatus('このモードにはデータがありません。');
                    }
                } catch (e) {
                    console.error("Failed to load cities", e);
                }
            }
        };
        fetchCities();
    }, [activeTab, effectiveMode, scanAvailableSatelliteCities, selectedCity]);

    // Update available DBs when city or tab changes
    useEffect(() => {
        const fetchDbs = async () => {
            if (activeTab && selectedCity && needsDb) {
                try {
                    const users = await scanAvailableSatelliteUsers(effectiveMode, selectedCity);
                    // Filter out the empty string which represents "All fields" naturally
                    const filteredUsers = users.filter(u => u !== '');
                    setAvailableDbs(filteredUsers);
                    
                    if (filteredUsers.length > 0) {
                        if (!selectedDb || !filteredUsers.includes(selectedDb)) {
                            setSelectedDb(filteredUsers[0]);
                        }
                    } else {
                        setSelectedDb('');
                    }
                } catch (e) {
                    console.error("Failed to load DBs", e);
                }
            } else if (!needsDb) {
                setAvailableDbs([]);
                setSelectedDb('');
            }
        };
        fetchDbs();
    }, [activeTab, effectiveMode, selectedCity, scanAvailableSatelliteUsers, selectedDb, needsDb]);

    // Update dates when city, db, or tab changes
    useEffect(() => {
        const fetchDates = async () => {
            if (selectedCity && effectiveMode) {
                try {
                    const dates = await scanAvailableSatelliteDates(effectiveMode, selectedCity, selectedDb || undefined);
                    setAvailableDates(dates);
                    if (dates.length > 0) {
                        setSelectedDate(dates[0]);
                    } else {
                        setSelectedDate('');
                        setSatelliteData(null);
                        setTiffBuffer(null);
                        setStatus('このモード/市町村/DBの組み合わせにはデータがありません。');
                    }
                } catch (e: any) {
                    setStatus(`日付読み込みエラー: ${e.message}`);
                }
            } else {
                setAvailableDates([]);
                setSelectedDate('');
            }
        };
        fetchDates();
    }, [selectedCity, selectedDb, effectiveMode, scanAvailableSatelliteDates]);

    // Update data when city, date, or tab changes
    useEffect(() => {
        const fetchData = async () => {
            if (selectedCity && selectedDate && effectiveMode) {
                setIsLoading(true);
                setStatus('衛星データを読み込み中...');
                // Clear state immediately to unmount components containing old data
                setSatelliteData(null);
                setTiffBuffer(null);
                try {
                    // Load geojson for the selected city
                    try {
                        const geo = await loadCityGeoJson(selectedCity);
                        // Filter the GeoJSON to only show user's registered polygons if DB is selected
                        if (selectedDb && userDb && needsDb) {
                             const dbKeys = Object.keys(userDb);
                             const filteredFeatures = geo.features.filter((f: any) => {
                                 const uuid = f.properties.polygon_uuid || f.properties.id;
                                 return dbKeys.includes(String(uuid));
                             });
                             setCityGeoJson({ ...geo, features: filteredFeatures });
                        } else {
                             setCityGeoJson(geo);
                        }
                    } catch (e) {
                        console.error("No geojson found for city", selectedCity);
                        setCityGeoJson(null);
                    }

                    // Load JSON if mode is NDVI or Flooded
                    if (activeTab === 'NDVI' || activeTab === 'Flooded') {
                        const json = await loadSatelliteJson(effectiveMode, selectedCity, selectedDate, selectedDb || undefined);
                        setSatelliteData(json);
                    } else {
                        setSatelliteData(null);
                    }

                    // Load TIFF for all modes
                    try {
                        const buffer = await loadSatelliteTiff(effectiveMode, selectedCity, selectedDate, undefined, selectedDb || undefined);
                        setTiffBuffer(buffer);
                    } catch (e) {
                        console.warn('No TIFF found or error loading TIFF.', e);
                        setTiffBuffer(null); // TIFF is optional
                    }

                    setStatus(`${selectedDate} のデータを読み込みました`);
                } catch (e: any) {
                    setStatus(`データ読み込みエラー: ${e.message}`);
                    setSatelliteData(null);
                    setTiffBuffer(null);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchData();
    }, [selectedCity, selectedDate, effectiveMode, loadSatelliteJson, loadSatelliteTiff, loadCityGeoJson]);

    return (
        <div className="flex w-full h-full">
            {/* Sidebar */}
            <aside className="w-80 bg-gray-50 border-r border-gray-300 flex flex-col z-20 shadow-md h-full">
                {/* Tabs */}
                <div className="flex border-b border-gray-300 bg-white shadow-sm">
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'NDVI' ? 'border-b-2 border-green-600 text-green-800' : 'text-gray-500 hover:bg-gray-100'}`}
                        onClick={() => setActiveTab('NDVI')}
                    >
                        NDVI
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'Flooded' ? 'border-b-2 border-blue-600 text-blue-800' : 'text-gray-500 hover:bg-gray-100'}`}
                        onClick={() => setActiveTab('Flooded')}
                    >
                        Flooded
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'TrueColor' ? 'border-b-2 border-gray-600 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
                        onClick={() => setActiveTab('TrueColor')}
                    >
                        TrueColor
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                    <div className="bg-blue-50 text-blue-800 p-2 rounded text-xs">
                        {isLoading ? '読み込み中...' : status}
                    </div>

                    {/* Flooded Sub-Mode Toggle */}
                    {activeTab === 'Flooded' && (
                        <div className="flex bg-gray-200 rounded-lg p-0.5">
                            <button
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                    floodedSubMode === 'Flooded' 
                                        ? 'bg-white text-blue-700 shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                                onClick={() => setFloodedSubMode('Flooded')}
                            >
                                光学 (MNDWI)
                            </button>
                            <button
                                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                    floodedSubMode === 'SAR_Flooded' 
                                        ? 'bg-white text-blue-700 shadow-sm' 
                                        : 'text-gray-600 hover:text-gray-800'
                                }`}
                                onClick={() => setFloodedSubMode('SAR_Flooded')}
                            >
                                SAR (雲透過)
                            </button>
                        </div>
                    )}

                    {needsDb && (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-gray-700">1. 保存先 (Target DB)</label>
                            <select
                                className="w-full p-2 border border-gray-300 rounded text-sm text-black"
                                value={selectedDb}
                                onChange={(e) => setSelectedDb(e.target.value)}
                            >
                                {availableDbs.map(db => (
                                    <option key={db} value={db}>{db}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">{needsDb ? '2.' : '1.'} エリア (市町村)</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm text-black"
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            disabled={availableCities.length === 0}
                        >
                            <option value="">-- 市町村を選択 --</option>
                            {availableCities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-bold text-gray-700">{needsDb ? '3.' : '2.'} 測定日 (Date)</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm text-black"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            disabled={!selectedCity || availableDates.length === 0}
                        >
                            <option value="">-- 日付を選択 --</option>
                            {availableDates.map(date => (
                                <option key={date} value={date}>{date}</option>
                            ))}
                        </select>
                    </div>

                    {/* Legend / Info */}
                    <div className="mt-4 p-4 border border-gray-200 rounded bg-white shadow-sm">
                        <h3 className="font-bold text-gray-800 text-sm mb-2">凡例 (Legend)</h3>
                        {activeTab === 'NDVI' ? (
                            <div className="text-xs text-gray-600 flex flex-col gap-2 mt-2">
                                <div className="flex w-full rounded border border-gray-300 overflow-hidden h-4">
                                    <div className="flex-1" style={{ backgroundColor: '#ffffbf' }} title="< 0.30"></div>
                                    <div className="flex-1" style={{ backgroundColor: '#cceb89' }} title="0.30 - 0.50"></div>
                                    <div className="flex-1" style={{ backgroundColor: '#91cf60' }} title="0.50 - 0.65"></div>
                                    <div className="flex-1" style={{ backgroundColor: '#40a947' }} title="0.65 - 0.80"></div>
                                    <div className="flex-1" style={{ backgroundColor: '#1a9641' }} title="≥ 0.80"></div>
                                </div>
                                <div className="flex justify-between text-[10px] px-0.5">
                                    <span>~0.30</span>
                                    <span>0.50</span>
                                    <span>0.65</span>
                                    <span>0.80~</span>
                                </div>
                            </div>
                        ) : activeTab === 'Flooded' ? (
                            <div className="text-xs text-gray-600 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-blue-500 opacity-80"></div>
                                    <span>湛水あり</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded bg-orange-200 opacity-80"></div>
                                    <span>未入水</span>
                                </div>
                                <div className="text-[10px] text-gray-500 bg-gray-100 p-1.5 rounded">
                                    {floodedSubMode === 'SAR_Flooded' 
                                        ? '閾値: 平均VV ≤ -14.0 dB → 湛水' 
                                        : '閾値: 大津法(MNDWI) ≥ 50% → 湛水'}
                                </div>
                                {/* Flooded Progress Summary */}
                                {satelliteData && !Array.isArray(satelliteData) && satelliteData.summary && (
                                    <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                                        <h4 className="font-bold text-blue-800 text-xs mb-2">湛水進捗</h4>
                                        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                            <div 
                                                className="bg-blue-500 h-3 rounded-full transition-all"
                                                style={{ width: `${Math.min(100, satelliteData.summary.progress_pct)}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-center font-bold text-blue-700 text-sm mb-2">
                                            {satelliteData.summary.progress_pct}%
                                        </div>
                                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                                            <div className="bg-white rounded p-1.5 text-center border">
                                                <div className="text-gray-500">湛水済</div>
                                                <div className="font-bold text-blue-700">{satelliteData.summary.flooded_area_ha} ha</div>
                                                <div className="text-gray-400">{satelliteData.summary.flooded_fields} 筆</div>
                                            </div>
                                            <div className="bg-white rounded p-1.5 text-center border">
                                                <div className="text-gray-500">全面積</div>
                                                <div className="font-bold text-gray-800">{satelliteData.summary.total_area_ha} ha</div>
                                                <div className="text-gray-400">{satelliteData.summary.total_fields} 筆</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-xs text-gray-600">
                                TrueColor画像機能では、マップ上に画像を直接オーバーレイ表示します（ポリゴンの着色は行いません）。
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main Map Area */}
            <div className="flex-1 relative z-0 bg-gray-100">
                <SatelliteMap 
                    geojsonData={cityGeoJson}
                    satelliteData={satelliteData}
                    tiffBuffer={tiffBuffer}
                    mode={activeTab === 'Flooded' ? 'Flooded' : activeTab}
                    activeDate={selectedDate}
                    selectedCity={selectedCity}
                    selectedDb={selectedDb}
                    userDb={userDb}
                    varieties={varieties}
                    floodedSubMode={activeTab === 'Flooded' ? floodedSubMode : undefined}
                />
            </div>
        </div>
    );
}
