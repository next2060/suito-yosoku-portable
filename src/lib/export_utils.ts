import { Feature, FeatureCollection } from "geojson";
import { centerOfMass } from "@turf/turf";
import { getStages } from "./stages";
// Types need to be adapted or imported
// For now defining minimal types here or importing from existing logic/types if available
import { GeoFeature } from "./logic/types";

// Adapting types from portable project
type UserDbRecord = {
  id: string; // Polygon UUID
  name?: string; // User-defined field name
  varietyId?: string;
  transplantDate?: string;
  headingDate?: string;
  maturityDate?: string;
  measurementDate?: string;
  panicleLength?: number;
  headingStatus?: string;
  maturityStatus?: string;
  updatedAt?: string;
  remarks?: string;
  // Add other fields as needed for export
  [key: string]: any;
};

// Use type from logic/types or define matching structure
type PredictionResult = {
  heading_date?: string | null;
  maturity_date?: string | null;
  met26?: number | null;
  error?: string;
};

// Common output row type definition
export interface FormattedExportRow {
  ポリゴンUUID: string;
  圃場名: string;
  品種: string;
  測定日?: string;
  幼穂長?: number | "";
  備考: string;
  緯度?: number | null;
  経度?: number | null;
  [key: string]: string | number | boolean | null | undefined; // For dynamic date/status columns
}

/**
 * Converts a single feature row data into a formatted export format.
 */
const formatSingleRow = (
  system: "rice" | "wheat",
  id: string,
  sourceData: UserDbRecord,
  prediction: PredictionResult, // Simplified PredictionResult
  geometry?: Feature["geometry"],
  municipalityCode?: string,
): FormattedExportRow => {
  const center =
    geometry?.type === "Polygon"
      ? centerOfMass(geometry).geometry.coordinates
      : [null, null];

  const row: FormattedExportRow = {
    ポリゴンUUID: id,
    圃場名: String(sourceData.name || ""),
    品種: String(sourceData.varietyId || ""),
    測定日: String(sourceData.measurementDate || ""),
    幼穂長: sourceData.panicleLength ?? "",
    備考: String(sourceData.remarks || ""),
    市町村コード: municipalityCode || "",
    緯度: center[1],
    経度: center[0],
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    // Assuming dateStr is in YYYY-MM-DD or MM-DD format, or valid Date string
    // Just extract MM-DD
    const match = dateStr.match(/(?:^\d{4}-)?(\d{2}-\d{2})(?:T.*)?$/);
    if (match) return match[1];

    // Fallback
    return String(dateStr);
  };

  const stages = getStages(system);

  for (const stage of stages) {
    let actualValue: string | undefined;
    let predictedValue: string | undefined | null;

    // Portable version mapping
    if (stage.key === "transplantDate") {
      actualValue = sourceData.transplantDate;
    } else if (stage.key === "headingDate") {
      // Source data heading date is actual if input by user
      if (sourceData.headingDate) {
        actualValue = sourceData.headingDate;
      } else {
        predictedValue = prediction.heading_date;
      }
    } else if (stage.key === "maturityDate") {
      if (sourceData.maturityDate) {
        actualValue = sourceData.maturityDate;
      } else {
        predictedValue = prediction.maturity_date;
      }
    }

    const baseKey = stage.key.replace('Date', '');
    const savedStatus = sourceData[`${baseKey}Status`];

    if (actualValue) {
      row[stage.label] = formatDate(actualValue);
      if (stage.key !== "transplantDate" && stage.key !== "sowingDate") {
        row[`${stage.label}_状態`] = savedStatus ?? "";
      }
    } else {
      const finalPredicted = predictedValue || "";
      row[stage.label] = formatDate(finalPredicted);
      if (stage.key !== "transplantDate" && stage.key !== "sowingDate") {
        row[`${stage.label}_状態`] = finalPredicted ? (savedStatus ?? "予測") : "";
      }
    }
  }

  if (system === "rice") {
    const met26Value = prediction.met26;
    if (met26Value !== null && met26Value !== undefined) {
      row["MET26"] = parseFloat(String(met26Value)).toFixed(1);
    } else {
      row["MET26"] = "";
    }
  }

  const errorValue = prediction.error;
  row["エラー"] = String(errorValue || "");

  return row;
};

/**
 * Formats data for the main page export.
 */
export const formatMainExportData = async (
  system: "rice" | "wheat",
  selectedFeatures: GeoFeature[],
  userDb: Record<string, UserDbRecord>,
  predictionResults: Map<string, PredictionResult>,
  municipalityCode?: string,
): Promise<FormattedExportRow[]> => {
  const data = await Promise.all(
    selectedFeatures.map(async (feature) => {
      const id = feature.properties.polygon_uuid || feature.properties.id;
      const savedData = userDb[id];
      if (!savedData) return null; // Only export saved data? Strategy: "target existing saved fields"

      const prediction = predictionResults.get(id) || {};

      return formatSingleRow(
        system,
        id,
        savedData,
        prediction,
        feature.geometry,
        municipalityCode,
      );
    }),
  );
  return data.filter((d): d is FormattedExportRow => d !== null);
};

/**
 * Generates a GeoJSON FeatureCollection from formatted data.
 */
export const createGeoJsonFromFormattedData = (
  formattedData: FormattedExportRow[],
  originalFeatures: GeoFeature[],
): FeatureCollection => {
  const newFeatures = originalFeatures
    .map((feature) => {
      const id = feature.properties.polygon_uuid || feature.properties.id;
      const matchingRow = formattedData.find(
        (row) => row["ポリゴンUUID"] === id,
      );

      if (!matchingRow) return null;

      return {
        ...feature,
        properties: matchingRow,
      };
    })
    .filter((f) => f !== null) as unknown as Feature[];

  return {
    type: "FeatureCollection",
    features: newFeatures,
  };
};

export const getChoroplethOptions = (system: "rice" | "wheat") => {
  const options = getStages(system)    .map(stage => ({
      value: stage.key as string, 
      label: stage.label
    }));

  if (system === "rice") {
    options.push({ value: "MET26", label: "MET26" });
  }
  return options;
};
