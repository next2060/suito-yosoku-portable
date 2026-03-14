import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useFileSystem as useFileSystemHook } from '@/lib/file_system/useFileSystem';
import { loadWeatherForPoint, readJson, scanFieldFiles, writeJson, scanUserDbFiles, scanSatelliteFiles, loadSingleMeshPng } from '@/lib/file_system/file_utils';
import { VarietyParams, WeatherData } from '@/lib/logic/types';
import { DEFAULT_VARIETIES } from '@/lib/varieties';

interface FileSystemContextType {
  directoryHandle: FileSystemDirectoryHandle | null;
  selectDirectory: () => Promise<void>;
  error: string | null;
  
  // Data States
  cityList: string[];
  weatherPoints: string[];
  varieties: VarietyParams[];
  userDb: any;
  dbList: string[];
  selectedDbName: string | null;
  
  // Accessors
  loadCityGeoJson: (cityName: string) => Promise<any>;
  loadWeatherData: (pointName: string) => Promise<WeatherData[]>;
  saveUserDb: (newData: any) => Promise<void>;
  saveVarieties: (newVarieties: VarietyParams[]) => Promise<void>;
  loadUserDb: (dbName: string) => Promise<void>;
  createNewDb: (dbName: string) => Promise<void>;
  
  // Satellite Accessors
  scanAvailableSatelliteCities: (mode: string) => Promise<string[]>;
  scanAvailableSatelliteUsers: (mode: string, cityName: string) => Promise<string[]>;
  scanAvailableSatelliteDates: (mode: string, cityName: string, userName?: string) => Promise<string[]>;
  loadSatelliteJson: (mode: string, cityName: string, dateStr: string, userName?: string) => Promise<any>;
  loadSatelliteTiff: (mode: string, cityName: string, dateStr: string, tiffPrefix?: string, userName?: string) => Promise<ArrayBuffer>;
  loadNdviMeshPng: (cityName: string, userName: string | undefined, dateStr: string, uuid: string) => Promise<{ buffer: ArrayBuffer, bounds: [[number, number], [number, number]] } | null>;
  
  // Status
  isLoading: boolean;
  statusMessage: string;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

export function FileSystemProvider({ children }: { children: React.ReactNode }) {
  const { directoryHandle, selectDirectory, error: hookError } = useFileSystemHook();
  
  const [cityList, setCityList] = useState<string[]>([]);
  const [weatherPoints, setWeatherPoints] = useState<string[]>([]);
  const [varieties, setVarieties] = useState<VarietyParams[]>([]);
  const [userDb, setUserDb] = useState<any>({});
  const [dbList, setDbList] = useState<string[]>([]);
  const [selectedDbName, setSelectedDbName] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [contextError, setContextError] = useState<string | null>(null);

  // Initialize Data when Directory is Selected
  useEffect(() => {
    if (!directoryHandle) return;

    const initData = async () => {
      setIsLoading(true);
      setStatusMessage('Initializing data...');
      try {
        // 1. Load User DB Directory and initialize first DB if available
        try {
           const userDbDirHandle = await directoryHandle.getDirectoryHandle('user_db', { create: true });
           const dbFiles = await scanUserDbFiles(userDbDirHandle);
           setDbList(dbFiles);
           
           if (dbFiles.length > 0) {
               setSelectedDbName(dbFiles[0]);
               try {
                   const db = await readJson(userDbDirHandle, `${dbFiles[0]}.json`);
                   setUserDb(db);
               } catch(e) {
                   console.log(`Failed reading ${dbFiles[0]}.json`);
                   setUserDb({});
               }
           } else {
               setSelectedDbName(null);
               setUserDb({});
           }
        } catch (e) {
           console.log("Error accessing or creating user_db folder.");
           setDbList([]);
           setSelectedDbName(null);
           setUserDb({});
        }

        // 2. Load Varieties
        try {
            const savedVarieties = await readJson(directoryHandle, 'varieties.json');
            if (Array.isArray(savedVarieties) && savedVarieties.length > 0) {
                // Merge/Overwrite defaults? Or just use saved?
                // Plan says: "Merge varieties.json and default varieties" or "Use varieties.json"
                // Let's assume varieties.json contains EVERYTHING (including edited defaults).
                setVarieties(savedVarieties);
            } else {
                setVarieties(DEFAULT_VARIETIES);
            }
        } catch (e) {
            console.log("No varieties.json found, using defaults.");
            setVarieties(DEFAULT_VARIETIES);
        }

        // 3. Scan Fields
        const fieldsHandle = await directoryHandle.getDirectoryHandle('fields');
        const files = await scanFieldFiles(fieldsHandle);
        setCityList(files.map(f => f.replace('.geojson', '')));

        // 4. Scan Weather
        const weatherHandle = await directoryHandle.getDirectoryHandle('weather');
        const wFiles: string[] = [];
        for await (const entry of weatherHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('_act.csv')) {
                wFiles.push(entry.name.replace('_act.csv', ''));
            }
        }
        setWeatherPoints(wFiles);
        
        setStatusMessage('Ready.');
      } catch (e: any) {
        setContextError(`Initialization Error: ${e.message}`);
        setStatusMessage('Error initializing data.');
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [directoryHandle]);

  // Wrappers
  const loadCityGeoJson = useCallback(async (cityName: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const fieldsHandle = await directoryHandle.getDirectoryHandle('fields');
      const fileHandle = await fieldsHandle.getFileHandle(`${cityName}.geojson`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
  }, [directoryHandle]);

  const loadWeather = useCallback(async (pointName: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const weatherHandle = await directoryHandle.getDirectoryHandle('weather');
      return await loadWeatherForPoint(weatherHandle, pointName);
  }, [directoryHandle]);

  const saveUserDb = useCallback(async (newData: any) => {
      if (!directoryHandle) throw new Error("No directory selected");
      if (!selectedDbName) throw new Error("No database selected");
      const userDbDirHandle = await directoryHandle.getDirectoryHandle('user_db', { create: true });
      await writeJson(userDbDirHandle, `${selectedDbName}.json`, newData);
      setUserDb(newData);
  }, [directoryHandle, selectedDbName]);

  const loadUserDb = useCallback(async (dbName: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      setIsLoading(true);
      setStatusMessage(`Loading DB: ${dbName}...`);
      try {
          const userDbDirHandle = await directoryHandle.getDirectoryHandle('user_db', { create: true });
          const db = await readJson(userDbDirHandle, `${dbName}.json`);
          setUserDb(db);
          setSelectedDbName(dbName);
          setStatusMessage(`Loaded DB: ${dbName}.`);
      } catch(e: any) {
          console.error(e);
          setStatusMessage(`Failed to load DB: ${dbName}`);
          throw e; // Rethrow to let caller handle it
      } finally {
          setIsLoading(false);
      }
  }, [directoryHandle]);

  const createNewDb = useCallback(async (dbName: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      if (!dbName) throw new Error("Database name cannot be empty");
      
      setIsLoading(true);
      setStatusMessage(`Creating new DB: ${dbName}...`);
      try {
          const userDbDirHandle = await directoryHandle.getDirectoryHandle('user_db', { create: true });
          
          // Check if it already exists
          const existing = await scanUserDbFiles(userDbDirHandle);
          if (existing.includes(dbName)) {
              throw new Error("Database already exists");
          }

          await writeJson(userDbDirHandle, `${dbName}.json`, {});
          
          // Refresh list and select new DB
          const updatedDbFiles = await scanUserDbFiles(userDbDirHandle);
          setDbList(updatedDbFiles);
          setUserDb({});
          setSelectedDbName(dbName);
          setStatusMessage(`Created and switched to DB: ${dbName}.`);
      } catch(e: any) {
          console.error(e);
          setStatusMessage(`Failed to create DB: ${e.message}`);
          throw e;
      } finally {
          setIsLoading(false);
      }
  }, [directoryHandle]);

  const saveVarieties = useCallback(async (newVarieties: VarietyParams[]) => {
      if (!directoryHandle) throw new Error("No directory selected");
      await writeJson(directoryHandle, 'varieties.json', newVarieties);
      setVarieties(newVarieties);
  }, [directoryHandle]);

  // --- Satellite Data Handlers ---
  const scanAvailableSatelliteCities = useCallback(async (mode: string) => {
      if (!directoryHandle) return [];
      try {
          const satHandle = await directoryHandle.getDirectoryHandle('satellite');
          const files = await scanSatelliteFiles(satHandle, mode);
          const availableCities = new Set<string>();
          files.forEach(f => {
              cityList.forEach(city => {
                  if (f.includes(`_${city}_`)) {
                      availableCities.add(city);
                  }
              });
          });
          return Array.from(availableCities);
      } catch (e) {
          return [];
      }
  }, [directoryHandle, cityList]);

  const scanAvailableSatelliteUsers = useCallback(async (mode: string, cityName: string) => {
      if (!directoryHandle) return [];
      try {
          const satHandle = await directoryHandle.getDirectoryHandle('satellite');
          const files = await scanSatelliteFiles(satHandle, mode);
          
          let prefix = '';
          let ext = '\\.json';
          if (mode === 'NDVI') prefix = 'NDVI_Results';
          if (mode === 'Flooded') prefix = 'Flooded_Results'; 
          if (mode === 'SAR_Flooded') prefix = 'SAR_Flooded_Results';
          if (mode === 'TrueColor') {
              prefix = 'TrueColor';
              ext = '\\.tif';
          }

          const users = new Set<string>();
          // Regex: PREFIX_CITY_USER_DATE.json/tif or PREFIX_CITY_DATE.json/tif
          const regexStr = `^${prefix}_${cityName}(?:_(.+?))?_(\\d{4}-\\d{2}-\\d{2})${ext}$`;
          const regex = new RegExp(regexStr);

          files.forEach(f => {
              const match = f.match(regex);
              if (match) {
                  // match[1] will be the user String (or undefined if no user suffix was used)
                  if (match[1]) {
                      users.add(match[1]);
                  } else {
                      users.add(''); // represents "No DB / Global"
                  }
              }
          });
          return Array.from(users).sort();
      } catch (e) {
          return [];
      }
  }, [directoryHandle]);

  const scanAvailableSatelliteDates = useCallback(async (mode: string, cityName: string, userName?: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const satHandle = await directoryHandle.getDirectoryHandle('satellite');
      const files = await scanSatelliteFiles(satHandle, mode);
      
      const dates = new Set<string>();
      const userSuffix = userName ? `_${userName}` : '';
      const regex = new RegExp(`_${cityName}${userSuffix}_(\\d{4}-\\d{2}-\\d{2})\\.`);

      files.forEach(f => {
          const match = f.match(regex);
          if (match) dates.add(match[1]);
      });
      return Array.from(dates).sort().reverse(); // Newest first
  }, [directoryHandle]);

  const loadSatelliteJson = useCallback(async (mode: string, cityName: string, dateStr: string, userName?: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const satHandle = await directoryHandle.getDirectoryHandle('satellite');
      const modeHandle = await satHandle.getDirectoryHandle(mode);
      
      let prefix = '';
      if (mode === 'NDVI') prefix = 'NDVI_Results';
      // For SAR or Optical Flooded
      if (mode === 'Flooded') prefix = 'Flooded_Results'; 
      if (mode === 'SAR_Flooded') prefix = 'SAR_Flooded_Results';
      
      const userSuffix = userName ? `_${userName}` : '';
      const filename = `${prefix}_${cityName}${userSuffix}_${dateStr}.json`;
      const fileHandle = await modeHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
  }, [directoryHandle]);

  const loadSatelliteTiff = useCallback(async (mode: string, cityName: string, dateStr: string, tiffPrefix?: string, userName?: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const satHandle = await directoryHandle.getDirectoryHandle('satellite');
      const modeHandle = await satHandle.getDirectoryHandle(mode);
      
      let prefix = tiffPrefix;
      if (!prefix) {
          if (mode === 'NDVI') prefix = 'NDVI';
          if (mode === 'Flooded') prefix = 'Flooded'; // For Flooded mode, default to Flooded_. User can pass MNDWI_ if needed.
          if (mode === 'TrueColor') prefix = 'TrueColor';
          if (mode === 'SAR_Flooded') prefix = 'SAR_Flooded'; // default for SAR
      }
      
      const userSuffix = userName ? `_${userName}` : '';
      const filename = `${prefix}_${cityName}${userSuffix}_${dateStr}.tif`;
      const fileHandle = await modeHandle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.arrayBuffer();
  }, [directoryHandle]);

  const loadNdviMeshPng = useCallback(async (cityName: string, userName: string | undefined, dateStr: string, uuid: string) => {
      if (!directoryHandle) throw new Error("No directory selected");
      const satHandle = await directoryHandle.getDirectoryHandle('satellite');
      return await loadSingleMeshPng(satHandle, cityName, userName, dateStr, uuid);
  }, [directoryHandle]);

  return (
    <FileSystemContext.Provider value={{
      directoryHandle,
      selectDirectory,
      error: hookError || contextError,
      cityList,
      weatherPoints,
      varieties,
      userDb,
      dbList,
      selectedDbName,
      loadCityGeoJson,
      loadWeatherData: loadWeather,
      saveUserDb,
      saveVarieties,
      loadUserDb,
      createNewDb,
      scanAvailableSatelliteCities,
      scanAvailableSatelliteUsers,
      scanAvailableSatelliteDates,
      loadSatelliteJson,
      loadSatelliteTiff,
      loadNdviMeshPng,
      isLoading,
      statusMessage
    }}>
      {children}
    </FileSystemContext.Provider>
  );
}

export function useFileSystemContext() {
  const context = useContext(FileSystemContext);
  if (context === undefined) {
    throw new Error('useFileSystemContext must be used within a FileSystemProvider');
  }
  return context;
}
