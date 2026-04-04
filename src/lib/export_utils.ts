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
 * All prediction values are read directly from DB records (sourceData).
 */
const formatSingleRow = (
  system: "rice" | "wheat",
  id: string,
  sourceData: UserDbRecord,
  geometry?: Feature["geometry"],
  municipalityCode?: string,
): FormattedExportRow => {
  const center =
    geometry?.type === "Polygon"
      ? centerOfMass(geometry).geometry.coordinates
      : [null, null];

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const match = dateStr.match(/(?:^\d{4}-)?(\d{2}-\d{2})(?:T.*)?$/);
    if (match) return match[1];
    return String(dateStr);
  };

  const stages = getStages(system);
  const row: any = {};

  // Build the row in the specific requested order (Rice context)
  row['ポリゴンUUID'] = id;
  row['圃場名'] = String(sourceData.name || "");
  row['品種'] = String(sourceData.varietyId || "");

  // Rice: 1st stage is "移植期" / Wheat: 1st stage is "播種期"
  const firstStage = stages[0];
  if (firstStage) {
    row[firstStage.label] = formatDate(sourceData[firstStage.key]);
  }

  // Pre-heading measurements
  row['測定日'] = formatDate(sourceData.measurementDate);
  row['幼穂長'] = sourceData.panicleLength ?? "";

  // All other stages (Heading/Maturity)
  for (let i = 1; i < stages.length; i++) {
    const stage = stages[i];
    const dateValue = sourceData[stage.key] || "";
    const baseKey = stage.key.replace('Date', '');
    const savedStatus = sourceData[`${baseKey}Status`];

    row[stage.label] = formatDate(dateValue);
    if (stage.key !== "transplantDate" && stage.key !== "sowingDate") {
      row[`${stage.label}_状態`] = dateValue ? (savedStatus ?? "") : "";
    }
  }

  // Rice specific MET26
  if (system === "rice") {
    const met26Value = sourceData.met26;
    if (met26Value !== null && met26Value !== undefined) {
      row["MET26"] = parseFloat(String(met26Value)).toFixed(1);
    } else {
      row["MET26"] = "";
    }
  }

  // Geometry and metadata
  row['緯度'] = center[1];
  row['経度'] = center[0];
  row['市町村コード'] = municipalityCode || "";
  row['備考'] = String(sourceData.remarks || "");
  row['エラー'] = "";

  return row;
};

/**
 * Formats data for the main page export.
 * Reads all data directly from DB — no prediction calculation is performed.
 */
export const formatMainExportData = async (
  system: "rice" | "wheat",
  selectedFeatures: GeoFeature[],
  userDb: Record<string, UserDbRecord>,
  municipalityCode?: string,
): Promise<FormattedExportRow[]> => {
  const data = await Promise.all(
    selectedFeatures.map(async (feature) => {
      const id = feature.properties.polygon_uuid || feature.properties.id;
      const savedData = userDb[id];
      if (!savedData) return null;

      const muniCode = feature.properties.local_government_cd || municipalityCode;

      return formatSingleRow(
        system,
        id,
        savedData,
        feature.geometry,
        muniCode,
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
