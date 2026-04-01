import {
  MapContainer,
  TileLayer,
  GeoJSON,
  useMap,
  Marker,
  Tooltip,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState, useCallback } from "react";
import { GeoFeature, VarietyParams } from "../lib/logic/types";

// Fix Leaflet icon issue in Next.js
// @ts-expect-error - Leaflet internals
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface MapComponentProps {
  geojsonData: any; // GeoJSON FeatureCollection
  onFeatureSelect: (feature: GeoFeature) => void;
  selectedFeatureIds: string[];
  userDb: any; // Pass userDb to check status
  varieties?: VarietyParams[];
}

const AMEDAS_STATIONS = [
  { name: "北茨城", lat: 36.833333, lon: 140.771667 },
  { name: "大子", lat: 36.778333, lon: 140.345 },
  { name: "常陸大宮", lat: 36.606667, lon: 140.325 },
  { name: "日立", lat: 36.58, lon: 140.645 },
  { name: "笠間", lat: 36.395, lon: 140.24 },
  { name: "水戸", lat: 36.38, lon: 140.466667 },
  { name: "古河", lat: 36.201667, lon: 139.716667 },
  { name: "下館", lat: 36.281667, lon: 139.988333 },
  { name: "下妻", lat: 36.168333, lon: 139.945 },
  { name: "鉾田", lat: 36.168333, lon: 140.526667 },
  { name: "つくば", lat: 36.056667, lon: 140.125 },
  { name: "土浦", lat: 36.103333, lon: 140.22 },
  { name: "鹿嶋", lat: 35.963333, lon: 140.621667 },
  { name: "龍ヶ崎", lat: 35.89, lon: 140.211667 },
];

// --- 地図タイプ切り替えコンポーネント ---
interface MapTypeControlProps {
  mapType: string;
  setMapType: (type: string) => void;
}

const MapTypeControl = ({ mapType, setMapType }: MapTypeControlProps) => {
  return (
    <div className="bg-white p-1 rounded shadow-lg flex space-x-1">
      <button
        onClick={() => setMapType("street")}
        className={`px-3 py-1 text-xs rounded ${mapType === "street" ? "bg-blue-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
      >
        標準
      </button>
      <button
        onClick={() => setMapType("satellite")}
        className={`px-3 py-1 text-xs rounded ${mapType === "satellite" ? "bg-blue-500 text-white" : "bg-white text-gray-700 hover:bg-gray-100"}`}
      >
        衛星写真
      </button>
    </div>
  );
};

// --- レイヤー表示切り替えコンポーネント ---
interface LayerToggleControlProps {
  show: boolean;
  setShow: (show: boolean) => void;
  label: string;
}

const LayerToggleControl = ({
  show,
  setShow,
  label,
}: LayerToggleControlProps) => {
  return (
    <div className="bg-white p-1 rounded shadow-lg">
      <button
        onClick={() => setShow(!show)}
        className="px-3 py-1 text-xs rounded bg-white text-gray-700 hover:bg-gray-100 w-20"
      >
        {label} {show ? "OFF" : "ON"}
      </button>
    </div>
  );
};

// --- 自動ズーム（Bounds合わせ）コンポーネント ---
// DB内に登録圃場があればそこにフォーカス、なければ市町村全域を表示
const MapBoundsUpdater = ({ geojsonData, userDb }: { geojsonData: any; userDb?: any }) => {
  const map = useMap();
  useEffect(() => {
    if (geojsonData && geojsonData.features && geojsonData.features.length > 0) {
      try {
        // If userDb exists, try to filter features to only DB-registered ones
        let targetGeoJson = geojsonData;
        if (userDb && Object.keys(userDb).length > 0) {
          const dbKeys = Object.keys(userDb);
          const dbFeatures = geojsonData.features.filter((f: any) => {
            const uuid = f.properties.polygon_uuid || f.properties.id;
            return dbKeys.includes(String(uuid));
          });
          if (dbFeatures.length > 0) {
            targetGeoJson = { ...geojsonData, features: dbFeatures };
          }
          // If no DB features found in this city, fall through to full city bounds
        }

        const layer = L.geoJSON(targetGeoJson);
        const bounds = layer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } catch (e) {
        console.error("Error setting bounds:", e);
      }
    }
  }, [geojsonData, userDb, map]);
  return null;
};

const VarietyLegend = ({ varieties }: { varieties?: VarietyParams[] }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (!varieties || varieties.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-[1000] bg-white/95 p-3 rounded shadow-lg border border-gray-300 pointer-events-auto">
      <div 
        className="flex justify-between items-center cursor-pointer select-none"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h4 className="text-xs font-bold text-gray-800">
          品種（Color Legend）
        </h4>
        <span className="text-gray-500 text-xs ml-4 font-bold">
          {isCollapsed ? "▼ 表示" : "▲ 閉じる"}
        </span>
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-2 mt-2 pt-2 border-t border-gray-200">
          {varieties.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <div
                className="w-4 h-4 flex-shrink-0 rounded border border-gray-400"
                style={{ backgroundColor: v.color || "#28a745" }}
              ></div>
              <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
                {v.name}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-1 pt-2 border-t border-gray-200">
            <div
              className="w-4 h-4 flex-shrink-0 rounded border border-gray-400"
              style={{ backgroundColor: "rgba(115, 231, 247, 0.5)" }}
            ></div>
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              未設定 / 未保存
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function MapComponent({
  geojsonData,
  onFeatureSelect,
  selectedFeatureIds,
  userDb,
  varieties,
}: MapComponentProps) {
  const geoJsonRef = useRef<L.GeoJSON>(null);
  const [mapType, setMapType] = useState("satellite");
  const [showFields, setShowFields] = useState(true);
  const [showAmedas, setShowAmedas] = useState(false);

  const onFeatureSelectRef = useRef(onFeatureSelect);

  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  const bindTooltipToLayer = useCallback(
    (feature: any, layer: any) => {
      const id = feature.properties.polygon_uuid || feature.properties.id;
      const record = userDb && userDb[id];

      if (layer.unbindTooltip) {
        layer.unbindTooltip();
      }

      if (record) {
        const varietyName =
          varieties?.find((v) => v.id === record.varietyId)?.name || "未設定";
        const tooltipContent = `
                <div class="text-xs">
                    <strong class="block text-sm border-b pb-1 mb-1">${record.name || id}</strong>
                    <div>品種: ${varietyName}</div>
                    <div>移植: ${record.transplantDate || "-"}</div>
                    ${record.headingDate ? `<div>出穂: ${record.headingDate} (${record.headingStatus !== undefined ? record.headingStatus : "実績"})</div>` : ""}
                    ${record.maturityDate ? `<div>成熟: ${record.maturityDate} (${record.maturityStatus !== undefined ? record.maturityStatus : "実績"})</div>` : ""}
                </div>
            `;
        layer.bindTooltip(tooltipContent, {
          permanent: false,
          direction: "auto",
          className: "custom-map-tooltip",
        });
      }
    },
    [userDb, varieties],
  );

  const onEachFeature = (feature: any, layer: L.Layer) => {
    // Handle Clicks
    layer.on({
      click: (e) => {
        L.DomEvent.stopPropagation(e);
        onFeatureSelectRef.current(feature);
      },
    });

    // Add Tooltips
    bindTooltipToLayer(feature, layer);
  };

  const getStyle = useCallback(
    (feature: any) => {
      const id = feature.properties.polygon_uuid || feature.properties.id;
      const isSelected = selectedFeatureIds.includes(id);
      const hasData = userDb && userDb[id];

      let fillColor = "rgba(115, 231, 247, 1)"; // Default Blue
      let fillOpacity = 0.2;

      if (hasData) {
        fillOpacity = 0.7;

        if (varieties) {
          const varietyId = userDb[id].varietyId;
          const variety = varieties.find((v: any) => v.id === varietyId);
          if (variety && variety.color) {
            fillColor = variety.color;
          }
          // No matching variety: keep default unregistered color
        }
      }

      if (isSelected) {
        fillColor = "#ff7800"; // Orange for selected
        fillOpacity = 0.8;
      }

      return {
        fillColor: fillColor,
        weight: 1, // Always 1
        opacity: 1,
        color: "white",
        dashArray: "3",
        fillOpacity: fillOpacity,
      };
    },
    [selectedFeatureIds, userDb, varieties],
  );

  // Imperative style and tooltip update
  useEffect(() => {
    if (geoJsonRef.current && geojsonData) {
      geoJsonRef.current.eachLayer((layer: any) => {
        if (layer.feature) {
          const style = getStyle(layer.feature);
          layer.setStyle(style);
          bindTooltipToLayer(layer.feature, layer);
        }
      });
    }
  }, [geojsonData, getStyle, bindTooltipToLayer]);

  return (
    <MapContainer
      center={[36.3, 140.3]}
      zoom={9}
      style={{ height: "100%", width: "100%" }}
    >
      {mapType === "street" && (
        <TileLayer
          attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
          url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
        />
      )}
      {mapType === "satellite" && (
        <TileLayer
          url="https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
          attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
        />
      )}
      {showFields && geojsonData && (
        <GeoJSON
          ref={geoJsonRef}
          data={geojsonData}
          style={getStyle}
          onEachFeature={onEachFeature}
        />
      )}
      {showAmedas &&
        AMEDAS_STATIONS.map((station, idx) => (
          <Marker key={idx} position={[station.lat, station.lon]}>
            <Tooltip direction="top" offset={[0, -20]} opacity={1} permanent>
              <span className="font-bold text-xs">{station.name}</span>
            </Tooltip>
          </Marker>
        ))}
      <div className="absolute bottom-6 left-2 z-[1000] flex flex-col items-start space-y-2 pointer-events-auto">
        <MapTypeControl mapType={mapType} setMapType={setMapType} />
        <LayerToggleControl
          show={showFields}
          setShow={setShowFields}
          label="圃場"
        />
        <LayerToggleControl
          show={showAmedas}
          setShow={setShowAmedas}
          label="アメダス"
        />
      </div>
      <VarietyLegend varieties={varieties} />
      {geojsonData && <MapBoundsUpdater geojsonData={geojsonData} userDb={userDb} />}
    </MapContainer>
  );
}
