import Papa from "papaparse";
import { WeatherData } from "../logic/types";

// Helper to read file text from handle
async function getFileText(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<string> {
  const fileHandle = await dirHandle.getFileHandle(filename);
  const file = await fileHandle.getFile();
  return await file.text();
}

// Helper to write file text
async function writeFileText(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  content: string,
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

// Helper to read JSON
export async function readJson<T>(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<T> {
  const text = await getFileText(dirHandle, filename);
  return JSON.parse(text);
}

// Helper to write JSON
export async function writeJson(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
  data: any,
): Promise<void> {
  const text = JSON.stringify(data, null, 2);
  await writeFileText(dirHandle, filename, text);
}

// Helper to read Weather CSV (Act/Avg)
// Filename convention: {PointName}_act.csv, {PointName}_avg.csv
// Format assumption: Header row, columns date, temperature...
// We need to parse strict format.
// user's `weather` folder.
export async function readWeatherCsv(file: File, type: 'act' | 'avg'): Promise<WeatherData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data: WeatherData[] = results.data
          .map((row: any) => {
            let dateStr = row["Date"] || row["date"] || row["年月日"];
            if (dateStr) {
              // Handle MM-DD or M/D format by prepending 2024 (leap year)
              if (dateStr.match(/^\d{1,2}[/-]\d{1,2}$/)) {
                // Normalize separator to hyphen and pad with zero if needed
                const parts = dateStr.split(/[/-]/);
                const month = parts[0].padStart(2, "0");
                const day = parts[1].padStart(2, "0");
                dateStr = `2024-${month}-${day}`;
              }
            }

            const temp = parseFloat(row["Temp"]?.trim() || row["temp"]?.trim() || row["平均気温"]?.trim() || "NaN");
            const temp_max = parseFloat(row["Temp_max"]?.trim() || row["temp_max"]?.trim() || row["最高気温"]?.trim() || "NaN");
            const temp_min = parseFloat(row["Temp_min"]?.trim() || row["temp_min"]?.trim() || row["最低気温"]?.trim() || "NaN");
            const precip = parseFloat(row["Precip"]?.trim() || row["precip"]?.trim() || row["Rain"]?.trim() || row["rain"]?.trim() || row["降水量"]?.trim() || "NaN");

            const item: WeatherData = {
              date: dateStr,
              temp: temp,
            };

            if (type === 'act') {
               if (!isNaN(temp)) item.temp_act = temp;
               if (!isNaN(temp_max)) item.temp_max_act = temp_max;
               if (!isNaN(temp_min)) item.temp_min_act = temp_min;
               if (!isNaN(precip)) item.precip_act = precip;
            } else {
               if (!isNaN(temp)) item.temp_avg = temp;
               if (!isNaN(temp_max)) item.temp_max_avg = temp_max;
               if (!isNaN(temp_min)) item.temp_min_avg = temp_min;
               if (!isNaN(precip)) item.precip_avg = precip;
            }

            return item;
          })
          .filter((d: any) => !isNaN(d.temp) && d.date);
        resolve(data);
      },
      error: (err: any) => reject(err),
    });
  });
}

// Function to load all weather data for a point (Act + Avg merged)
export async function loadWeatherForPoint(
  weatherDirHandle: FileSystemDirectoryHandle,
  pointName: string,
): Promise<WeatherData[]> {
  // Try to find _act and _avg files
  // Since we can't guess the exact casing of filename if it varies,
  // we might need to iterate directory or assume standard naming.
  // Spec says "{PointName}_act.csv".

  // Load Act
  let actData: WeatherData[] = [];
  try {
    const actHandle = await weatherDirHandle.getFileHandle(
      `${pointName}_act.csv`,
    );
    const actFile = await actHandle.getFile();
    actData = await readWeatherCsv(actFile, 'act');
  } catch (e) {
    console.warn(`No Act data for ${pointName}`);
  }

  // Load Avg
  let avgData: WeatherData[] = [];
  try {
    const avgHandle = await weatherDirHandle.getFileHandle(
      `${pointName}_avg.csv`,
    );
    const avgFile = await avgHandle.getFile();
    avgData = await readWeatherCsv(avgFile, 'avg');
  } catch (e) {
    console.warn(`No Avg data for ${pointName}`);
  }

  // Merge: Act and Avg into single objects
  const merged = new Map<string, WeatherData>();

  // First fill with Avg
  for (const d of avgData) {
    merged.set(d.date, { ...d });
  }
  // Overwrite/Combine with Act
  for (const d of actData) {
    if (merged.has(d.date)) {
        const existing = merged.get(d.date)!;
        merged.set(d.date, { ...existing, ...d, temp: d.temp }); // Act temp overrides Avg temp for prediction logic base
    } else {
        merged.set(d.date, { ...d });
    }
  }

  // Filter ONLY dates between 04-01 and 10-31 as requested
  const isTargetDate = (dateStr: string) => {
      // dateStr format is expected 'YYYY-MM-DD'
      const mmdd = dateStr.slice(5);
      return mmdd >= '04-01' && mmdd <= '10-31';
  };

  // Sort by date
  return Array.from(merged.values())
    .filter(d => isTargetDate(d.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Function to scan 'fields' directory for GeoJSONs
export async function scanFieldFiles(
  fieldsDirHandle: FileSystemDirectoryHandle,
): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of fieldsDirHandle.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".geojson")) {
      files.push(entry.name);
    }
  }
  return files;
}

// Function to scan 'user_db' directory for JSONs
export async function scanUserDbFiles(
  dbDirHandle: FileSystemDirectoryHandle,
): Promise<string[]> {
  const files: string[] = [];
  for await (const entry of dbDirHandle.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".json")) {
      files.push(entry.name.replace('.json', ''));
    }
  }
  return files;
}

// Function to scan 'satellite' directory for files
export async function scanSatelliteFiles(
  satelliteDirHandle: FileSystemDirectoryHandle,
  modeDir: string // 'NDVI', 'Flooded', 'TrueColor'
): Promise<string[]> {
  const files: string[] = [];
  try {
      const modeHandle = await satelliteDirHandle.getDirectoryHandle(modeDir);
      for await (const entry of modeHandle.values()) {
          if (entry.kind === "file") {
              files.push(entry.name);
          }
      }
  } catch (e) {
      console.warn(`Could not access satellite directory: ${modeDir}`);
  }
  return files;
}

// Function to load a specific NDVI mesh PNG and its bounds
export async function loadSingleMeshPng(
  satelliteDirHandle: FileSystemDirectoryHandle,
  cityName: string,
  userName: string | undefined,
  dateStr: string,
  uuid: string
): Promise<{ buffer: ArrayBuffer, bounds: [[number, number], [number, number]] } | null> {
  try {
     const ndviHandle = await satelliteDirHandle.getDirectoryHandle('NDVI');
     const userSuffix = userName ? `_${userName}` : '';
     const folderName = `mesh_${cityName}${userSuffix}_${dateStr}`;
     const meshDirHandle = await ndviHandle.getDirectoryHandle(folderName);
     
     const pngHandle = await meshDirHandle.getFileHandle(`${uuid}.png`);
     const pngFile = await pngHandle.getFile();
     const buffer = await pngFile.arrayBuffer();
     
     const jsonHandle = await meshDirHandle.getFileHandle(`${uuid}_bounds.json`);
     const jsonFile = await jsonHandle.getFile();
     const text = await jsonFile.text();
     const boundsData = JSON.parse(text);
     
     return {
        buffer,
        bounds: boundsData.bounds
     };
  } catch (e) {
     return null;
  }
}
