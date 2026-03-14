import { useState, useEffect } from 'react';
import { useFileSystemContext } from '@/contexts/FileSystemContext';
import { GeoFeature, WeatherData } from '@/lib/logic/types';
import { usePrediction } from '@/hooks/usePrediction';
import { useExport } from '@/hooks/useExport';

import SetupPanel from '@/components/sidebar/SetupPanel';
import FieldSettingsPanel from '@/components/sidebar/FieldSettingsPanel';
import ExportPanel from '@/components/sidebar/ExportPanel';

import MapComponent from '@/components/MapComponent';
import VarietySettings from '@/components/VarietySettings';
import CsvImport from '@/components/CsvImport';
import WeatherViewer from '@/components/WeatherViewer';
import SatelliteViewer from '@/components/SatelliteViewer';


export default function Home() {
  const { 
      directoryHandle, 
      selectDirectory, 
      error, 
      cityList, 
      weatherPoints, 
      varieties, 
      userDb,
      dbList,
      selectedDbName,
      loadCityGeoJson,
      loadWeatherData,
      saveUserDb,
      loadUserDb,
      createNewDb,
      statusMessage: contextStatus
  } = useFileSystemContext();

  const [fields, setFields] = useState<any>(null); // GeoJSON
  const [selectedFeatures, setSelectedFeatures] = useState<GeoFeature[]>([]);
  
  // View State: 'map', 'varieties', 'csv', 'weather', 'satellite'
  const [currentView, setCurrentView] = useState<'map' | 'varieties' | 'csv' | 'weather' | 'satellite'>('map');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'setup' | 'field' | 'export'>('setup');
  
  // Data States
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedWeatherPoint, setSelectedWeatherPoint] = useState<string>('');
  const [loadedWeatherData, setLoadedWeatherData] = useState<WeatherData[]>([]);

  // UI States
  const [status, setStatus] = useState<string>('Select Data Folder to begin.');

  // Form States
  const [formFieldName, setFormFieldName] = useState<string>(''); // --- Form States for Field Editing ---
  const [formVarietyId, setFormVarietyId] = useState<string>('');
  const [formTransplantDate, setFormTransplantDate] = useState<string>('');
  const [formHeadingDate, setFormHeadingDate] = useState<string>('');
  const [formHeadingStatus, setFormHeadingStatus] = useState<string>('実績');
  const [formMaturityDate, setFormMaturityDate] = useState<string>('');
  const [formMaturityStatus, setFormMaturityStatus] = useState<string>('予測');
  const [newDbName, setNewDbName] = useState<string>('');

  const {
      calculationResult, setCalculationResult,
      formatUIDate,
      calculatePrediction,
      runPredictionForFeature,
      handleBatchRepredict
  } = usePrediction({
      userDb, saveUserDb, selectedDbName, fields, selectedFeatures,
      varieties, loadedWeatherData, setStatus,
      formVarietyId, formTransplantDate
  });

  const {
      isExporting,
      handleCsvExport, handleGeoJsonExport, handleHtmlExport
  } = useExport({
      userDb, saveUserDb, selectedDbName, fields, selectedFeatures,
      varieties, loadedWeatherData, setStatus, runPredictionForFeature
  });

  // Sync status
  useEffect(() => {
     if (contextStatus) setStatus(contextStatus);
  }, [contextStatus]);

  // --- City Selection ---
  const loadCity = async (cityName: string) => {
      if (!directoryHandle) return;
      setStatus(`Loading city: ${cityName}...`);
      
      // Clear previous fields and selections
      setFields(null);
      setSelectedFeatures([]);
      setCalculationResult(null);

      try {
          const json = await loadCityGeoJson(cityName);
          setFields(json);
          setSelectedCity(cityName);
          setStatus(`Loaded ${cityName}.`);
      } catch (e: any) {
          setStatus(`Error loading city: ${e.message}`);
      }
  };

  // --- Weather Selection ---
  const loadWeather = async (pointName: string) => {
      if (!directoryHandle) return;
      setStatus(`Loading weather: ${pointName}...`);
      try {
          const data = await loadWeatherData(pointName);
          setLoadedWeatherData(data);
          setSelectedWeatherPoint(pointName);
          setStatus(`Loaded weather for ${pointName}.`);
      } catch (e: any) {
           setStatus(`Error loading weather: ${e.message}`);
      }
  };

  // --- Feature Selection ---
  const onFeatureSelect = (feature: GeoFeature) => {
      const clickedUuid = feature.properties.polygon_uuid || feature.properties.id;
      
      const isAlreadySelected = selectedFeatures.some(f => 
          (f.properties.polygon_uuid || f.properties.id) === clickedUuid
      );

      let newSelectedFeatures: GeoFeature[];

      if (isAlreadySelected) {
          // Deselect
          newSelectedFeatures = selectedFeatures.filter(f => 
             (f.properties.polygon_uuid || f.properties.id) !== clickedUuid
          );
      } else {
          // Select (Add)
          newSelectedFeatures = [...selectedFeatures, feature];
      }

      setSelectedFeatures(newSelectedFeatures);
      setCalculationResult(null);

      // Form Loading Logic
      if (newSelectedFeatures.length === 1) {
          // Single select: Load from DB if exists
          const uuid = newSelectedFeatures[0].properties.polygon_uuid || newSelectedFeatures[0].properties.id;
          if (userDb[uuid]) {
              const rec = userDb[uuid];
              setFormFieldName(rec.name || '');
              setFormVarietyId(rec.varietyId || varieties[0]?.id || '');
              setFormTransplantDate(rec.transplantDate || '');
              setFormHeadingDate(rec.headingDate || '');
              setFormHeadingStatus(rec.headingStatus || '');
              setFormMaturityDate(rec.maturityDate || '');
              setFormMaturityStatus(rec.maturityStatus || '');
          } else {
              // Defaults (Empty)
              setFormFieldName('');
              setFormVarietyId('');
              setFormTransplantDate('');
              setFormHeadingDate('');
              setFormHeadingStatus('');
              setFormMaturityDate('');
              setFormMaturityStatus('');
          }
      } else if (newSelectedFeatures.length === 0) {
          // No selection: Clear form
          setFormFieldName('');
          setFormVarietyId('');
          setFormTransplantDate('');
          setFormHeadingDate('');
          setFormHeadingStatus('');
          setFormMaturityDate('');
          setFormMaturityStatus('');
      } else {
          // Multiple selection: Keep current form values (do nothing)
      }
  };

  const handleSelectAllSaved = () => {
      if (!fields || !fields.features || !userDb) return;
      const savedUuids = Object.keys(userDb);
      const savedFeatures = fields.features.filter((f: GeoFeature) => {
          const uuid = f.properties.polygon_uuid || f.properties.id;
          return savedUuids.includes(String(uuid));
      });
      setSelectedFeatures(savedFeatures);
      setCalculationResult(null);
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="bg-green-700 text-white p-4 flex justify-between items-center shadow-md z-10">
        <h1 className="text-xl font-bold">水稲生育予測システム (Local)</h1>
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setCurrentView('map')}
                disabled={!directoryHandle}
                className={`text-sm px-3 py-1 rounded font-bold transition-all
                    ${currentView === 'map' ? 'bg-green-800 ring-2 ring-white text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                MAP
            </button>
            <button 
                onClick={() => setCurrentView('weather')}
                disabled={!directoryHandle}
                className={`text-sm px-3 py-1 rounded font-bold transition-all
                    ${currentView === 'weather' ? 'bg-green-800 ring-2 ring-white text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                WEATHER
            </button>
            <button 
                onClick={() => setCurrentView('csv')}
                disabled={!directoryHandle}
                 className={`text-sm px-3 py-1 rounded font-bold transition-all
                    ${currentView === 'csv' ? 'bg-green-800 ring-2 ring-white text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                CSV Import
            </button>
            <button 
                onClick={() => setCurrentView('satellite')}
                disabled={!directoryHandle}
                 className={`text-sm px-3 py-1 rounded font-bold transition-all
                    ${currentView === 'satellite' ? 'bg-green-800 ring-2 ring-white text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                Satellite
            </button>
            <button 
                onClick={() => setCurrentView('varieties')}
                disabled={!directoryHandle}
                className={`text-sm px-3 py-1 rounded font-bold transition-all
                    ${currentView === 'varieties' ? 'bg-green-800 ring-2 ring-white text-white' : 'bg-green-600 hover:bg-green-500 text-white'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
            >
                Manage Varieties
            </button>

            {directoryHandle ? (
                <span className="text-sm bg-green-800 px-3 py-1 rounded">
                    Data Loaded {selectedFeatures.length > 0 && `(${selectedFeatures.length} selected)`}
                </span>
            ) : (
                <button 
                    onClick={selectDirectory}
                    className="bg-white text-green-700 px-4 py-2 rounded hover:bg-gray-100 font-bold"
                >
                    Select Data Folder
                </button>
            )}
        </div>
      </header>
      
      <main className="flex-1 flex overflow-hidden">
        {currentView === 'varieties' ? (
            <div className="w-full h-full overflow-auto">
                <VarietySettings />
            </div>
        ) : currentView === 'csv' ? (
             <div className="w-full h-full overflow-auto">
                <CsvImport 
                    onBatchRepredict={handleBatchRepredict} 
                    hasWeatherLoaded={loadedWeatherData.length > 0} 
                    weatherPoints={weatherPoints}
                    selectedWeatherPoint={selectedWeatherPoint}
                    loadWeather={loadWeather}
                    globalSelectedCity={selectedCity}
                    globalLoadCity={loadCity}
                    globalFields={fields}
                />
             </div>
        ) : currentView === 'weather' ? (
             <div className="w-full h-full overflow-hidden">
                <WeatherViewer />
             </div>
        ) : currentView === 'satellite' ? (
             <div className="w-full h-full overflow-hidden">
                <SatelliteViewer />
             </div>
        ) : (
            <>
                {/* Sidebar */}
                <aside className="w-80 bg-gray-50 p-4 overflow-y-auto border-r border-gray-300 flex flex-col gap-4">
                    {/* ... (Sidebar content remains same) ... */}
                    {error && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{error}</div>}
                    <div className="bg-blue-50 text-blue-800 p-2 rounded text-xs">{status}</div>

                    {/* Sidebar Tabs */}
                    {directoryHandle && (
                        <div className="flex border-b border-gray-300">
                            <button
                                className={`flex-1 py-2 text-xs font-bold transition-colors ${activeSidebarTab === 'setup' ? 'border-b-2 border-green-600 text-green-800 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                onClick={() => setActiveSidebarTab('setup')}
                            >
                                Setup
                            </button>
                            <button
                                className={`flex-1 py-2 text-xs font-bold transition-colors ${activeSidebarTab === 'field' ? 'border-b-2 border-green-600 text-green-800 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                onClick={() => setActiveSidebarTab('field')}
                            >
                                Field Data
                            </button>
                            <button
                                className={`flex-1 py-2 text-xs font-bold transition-colors ${activeSidebarTab === 'export' ? 'border-b-2 border-green-600 text-green-800 bg-white' : 'text-gray-500 hover:bg-gray-100'}`}
                                onClick={() => setActiveSidebarTab('export')}
                            >
                                Export
                            </button>
                        </div>
                    )}

                    {/* Setup Panel */}
                    {directoryHandle && activeSidebarTab === 'setup' && (
                        <SetupPanel
                            dbList={dbList}
                            selectedDbName={selectedDbName}
                            loadUserDb={loadUserDb}
                            setSelectedFeatures={setSelectedFeatures}
                            setCalculationResult={setCalculationResult}
                            newDbName={newDbName}
                            setNewDbName={setNewDbName}
                            createNewDb={createNewDb}
                            cityList={cityList}
                            selectedCity={selectedCity}
                            loadCity={loadCity}
                            weatherPoints={weatherPoints}
                            selectedWeatherPoint={selectedWeatherPoint}
                            loadWeather={loadWeather}
                        />
                    )}

                    {/* Feature Form Panel */}
                    {activeSidebarTab === 'field' && (
                        <FieldSettingsPanel
                            selectedFeatures={selectedFeatures}
                            setSelectedFeatures={setSelectedFeatures}
                            calculationResult={calculationResult}
                            setCalculationResult={setCalculationResult}
                            setStatus={setStatus}
                            formFieldName={formFieldName}
                            setFormFieldName={setFormFieldName}
                            varieties={varieties}
                            formVarietyId={formVarietyId}
                            setFormVarietyId={setFormVarietyId}
                            formTransplantDate={formTransplantDate}
                            setFormTransplantDate={setFormTransplantDate}
                            formHeadingDate={formHeadingDate}
                            setFormHeadingDate={setFormHeadingDate}
                            formHeadingStatus={formHeadingStatus}
                            setFormHeadingStatus={setFormHeadingStatus}
                            formMaturityDate={formMaturityDate}
                            setFormMaturityDate={setFormMaturityDate}
                            formMaturityStatus={formMaturityStatus}
                            setFormMaturityStatus={setFormMaturityStatus}
                            selectedDbName={selectedDbName}
                            directoryHandle={directoryHandle}
                            calculatePrediction={calculatePrediction}
                            userDb={userDb}
                            saveUserDb={saveUserDb}
                            formatUIDate={formatUIDate}
                            onSelectAllSaved={handleSelectAllSaved}
                        />
                    )}
                    
                    {/* Export Panel */}
                    {directoryHandle && activeSidebarTab === 'export' && (
                        <ExportPanel
                            handleCsvExport={handleCsvExport}
                            handleGeoJsonExport={handleGeoJsonExport}
                            handleHtmlExport={handleHtmlExport}
                            isExporting={isExporting}
                        />
                    )}
                    
                </aside>

                {/* Map Area */}
                <div className="flex-1 relative bg-gray-200">
                    <MapComponent 
                        geojsonData={fields} 
                        onFeatureSelect={onFeatureSelect}
                        selectedFeatureIds={selectedFeatures.map(f => f.properties.polygon_uuid || f.properties.id)}
                        userDb={userDb}
                        varieties={varieties}
                    />
                </div>
            </>
        )}
      </main>
    </div>
  );
}
