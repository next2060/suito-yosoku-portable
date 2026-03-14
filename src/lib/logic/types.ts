export interface VarietyParams {
    id: string;
    name: string;
    gv: number; // Grain filling value? (Inverse of)
    th: number; // Base temperature?
    lc: number; // Critical day length?
    a: number;  // Parameter for temp function
    b: number;  // Parameter for day length function
    tmax: number; // Accumulated temp for maturity
    Adj: number; // Adjustment days
    DVS: number; // Initial DVS
    dvs_star?: number; // Critical DVS for photosensitivity
    color?: string; // Hex color code for map display
    baseVarietyId?: string; // ID of the base variety this was derived from
}

export interface WeatherData {
    date: string; // YYYY-MM-DD or MM-DD
    temp: number; // Mean temperature (merged or available)
    lat?: number;
    lon?: number;
    // Data specific fields for charting
    temp_act?: number;
    temp_max_act?: number;
    temp_min_act?: number;
    precip_act?: number;

    temp_avg?: number;
    temp_max_avg?: number;
    temp_min_avg?: number;
    precip_avg?: number;
}

export interface PredictionResult {
    heading_date: string | null;
    maturity_date: string | null;
    met26?: number | null;
    error?: string;
}

export interface GeoFeature {
    type: "Feature";
    properties: {
        id: string;
        name?: string;
        variety?: string;
        transplant_date?: string;
        heading_date?: string; // Actual heading date
        maturity_date?: string; // Actual maturity date
        [key: string]: any;
    };
    geometry: {
        type: "Polygon" | "MultiPolygon";
        coordinates: any[];
    };
}
