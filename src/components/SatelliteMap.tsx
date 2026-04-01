import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ImageOverlay, useMapEvents } from 'react-leaflet';
import { useFileSystemContext } from '../contexts/FileSystemContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';
import { VarietyParams } from '../lib/logic/types';

interface SatelliteMapProps {
    geojsonData: any;
    satelliteData: any | null;
    tiffBuffer: ArrayBuffer | null;
    mode: 'NDVI' | 'Flooded' | 'TrueColor';
    activeDate: string;
    selectedCity?: string;
    selectedDb?: string;
    userDb?: any;
    varieties?: VarietyParams[];
    floodedSubMode?: 'Flooded' | 'SAR_Flooded';
}

// --- 地図タイプ切り替えコンポーネント ---
interface MapTypeControlProps {
  mapType: string;
  setMapType: (type: string) => void;
}

const MapTypeControl = ({ mapType, setMapType }: MapTypeControlProps) => {
  return (
    <div className="bg-white p-1 rounded shadow-lg flex space-x-1">
      <button
        onClick={() => setMapType('street')}
        className={`px-3 py-1 text-xs rounded ${mapType === 'street' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
      >
        標準
      </button>
      <button
        onClick={() => setMapType('satellite')}
        className={`px-3 py-1 text-xs rounded ${mapType === 'satellite' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
      >
        衛星写真
      </button>
    </div>
  );
};

// Removed LayerRadioControl as per user request to enforce strict view modes

// Automatically update bounds when geojsonData changes
const MapBoundsUpdater = ({ geojsonData, activeDate, selectedDb }: { geojsonData: any, activeDate: string, selectedDb?: string }) => {
    const map = useMap();
    useEffect(() => {
        // Enforce fit bounds when selecting a different date or DB filtering triggers new geojsonData
        if (geojsonData && geojsonData.features && geojsonData.features.length > 0) {
            try {
                const layer = L.geoJSON(geojsonData);
                const bounds = layer.getBounds();
                if (bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20] });
                }
            } catch (e) {
                console.error("Error setting bounds:", e);
            }
        }
    }, [geojsonData, activeDate, selectedDb, map]);
    return null;
};

// Component to handle map background clicks (to clear overlays)
const MapClickHandler = ({ clearOverlay }: { clearOverlay: () => void }) => {
    useMapEvents({
        click: () => {
            clearOverlay();
        },
    });
    return null;
};

// Component to handle GeoTIFF rendering
const TiffLayer = ({ tiffBuffer, mode }: { tiffBuffer: ArrayBuffer | null, mode: string }) => {
    const map = useMap();
    const paneName = useRef(`tiff-pane-${Math.random().toString(36).substring(2, 9)}`).current;
    
    useEffect(() => {
        console.log(`[TiffLayer-Hook] Running for mode: ${mode}, buffer valid: ${!!tiffBuffer}, length: ${tiffBuffer?.byteLength}`);
        if (!tiffBuffer) return;

        // Create a unique pane for this exact layer to prevent zombie tiles from async rendering
        let pane = map.getPane(paneName);
        if (!pane) {
            pane = map.createPane(paneName);
            pane.style.zIndex = '400'; // above baseline tiles (200) but below geojson (400 default overlay)
        }

        let layer: any;
        let isMounted = true;
        const bufferCopy = tiffBuffer.slice(0);

        parseGeoraster(bufferCopy).then((georaster: any) => {
            console.log(`[TiffLayer-Parse] Success. Mode: ${mode}, Size: ${georaster.width}x${georaster.height}`);
            if (!isMounted) return;
            // Define custom behavior based on mode. For now we just render it.
            // GeoRasterLayer config
            const options: any = {
                georaster: georaster,
                pane: paneName,
                opacity: mode === 'TrueColor' ? 1.0 : 0.7,
                resolution: 512, // Higher resolution for better clarity
                pixelValuesToColorFn: (values: any) => {
                    if (mode === 'TrueColor') {
                        // values is [r, g, b]
                        let r = values[0];
                        let g = values[1];
                        let b = values[2];
                        if (r === 0 && g === 0 && b === 0) return null; // transparent background
                        
                        // Brightness stretch manually (multiply by 1.5) as Sentinel-2 TCI can be dark
                        r = Math.min(255, Math.round(r * 1.5));
                        g = Math.min(255, Math.round(g * 1.5));
                        b = Math.min(255, Math.round(b * 1.5));
                        return `rgb(${r}, ${g}, ${b})`;
                        
                    } else if (mode === 'NDVI') {
                        // values is [ndvi_value]
                        const val = values[0];
                        if (val === undefined || isNaN(val) || val === -9999) return null;
                        if (val <= 0) return null; // Don't show water/barren
                        // 5-step discrete palette matching get_sentinel.py PNG output
                        if (val < 0.30) return 'rgba(255, 255, 191, 0.85)'; // #ffffbf
                        if (val < 0.50) return 'rgba(204, 235, 137, 0.85)'; // #cceb89
                        if (val < 0.65) return 'rgba(145, 207, 96, 0.85)';  // #91cf60
                        if (val < 0.80) return 'rgba(64, 169, 71, 0.85)';   // #40a947
                        return 'rgba(26, 150, 65, 0.85)';                   // #1a9641
                        
                    } else if (mode === 'Flooded') {
                        // values is [flooded_or_mndwi_value]
                        const val = values[0];
                        if (val === undefined || isNaN(val) || val === -9999 || val <= 0) return null; 
                        
                        // If it's 1.0 (Flooded_ tif), or 0~1 (MNDWI), map it to blue intensity
                        const alpha = Math.min(1, Math.max(0.3, val));
                        return `rgba(0, 50, 255, ${alpha})`;
                    }
                    return null;
                }
            };
            
            // georaster-layer-for-leaflet creates the layer
            layer = new GeoRasterLayer(options);
            layer.addTo(map);

            // For TrueColor, we don't display polygons directly, so let's ensure the map 
            // pans nicely to the bounds of the loaded image itself.
            if (mode === 'TrueColor') {
                const bounds = layer.getBounds();
                if (bounds && bounds.isValid()) {
                    map.fitBounds(bounds, { padding: [20, 20] });
                }
            }
            
            // Put it under geojson if geojson exists
            layer.setZIndex(10);
            console.log(`[TiffLayer] Added GeoRasterLayer to map. Layer ID:`, (layer as any)._leaflet_id);
        }).catch((e: any) => {
            console.error('Failed to parse GeoTIFF:', e);
        });

        return () => {
            console.log(`[TiffLayer-Cleanup] Running cleanup for mode: ${mode}`);
            isMounted = false;
            
            // 1. Remove layer from map explicitly
            if (layer) {
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                    console.log(`[TiffLayer] Removed from map.`);
                }
                if (typeof layer.remove === 'function') {
                    layer.remove(); // specific to georaster-layer
                }
            }
            
            // 2. Eradicate the custom pane from the DOM entirely to kill zombie tiles
            const existingPane = map.getPane(paneName);
            if (existingPane) {
                existingPane.remove();
                // Also remove it from leaflet's internal _panes object to prevent memory leaks
                if ((map as any)._panes && (map as any)._panes[paneName]) {
                    delete (map as any)._panes[paneName];
                }
                console.log(`[TiffLayer] Destroyed custom pane: ${paneName}`);
            }
        };
    }, [tiffBuffer, map, mode]);

    return null;
};

export default function SatelliteMap({ geojsonData, satelliteData, tiffBuffer, mode, activeDate, selectedCity, selectedDb, userDb, varieties, floodedSubMode }: SatelliteMapProps) {
    const [mapKey, setMapKey] = useState<number>(0);
    const [mapType, setMapType] = useState('satellite');
    const [meshOverlay, setMeshOverlay] = useState<{ url: string, bounds: L.LatLngBoundsExpression } | null>(null);
    const { loadNdviMeshPng } = useFileSystemContext();

    useEffect(() => {
        setMeshOverlay(prev => {
            if (prev?.url) {
                URL.revokeObjectURL(prev.url);
            }
            return null; // clear overlay on parameter changes
        });
    }, [activeDate, selectedCity, selectedDb, mode]);

    // Cleanup strictly on unmount
    useEffect(() => {
        return () => {
            setMeshOverlay(prev => {
                if (prev?.url) URL.revokeObjectURL(prev.url);
                return null;
            });
        };
    }, []);

    // Create a stable string representation for the buffer to use as a key
    const tiffKey = tiffBuffer ? `${mode}-${activeDate}-${tiffBuffer.byteLength}` : 'no-tiff';

    // Force re-render of GeoJSON when satellite data changes to re-apply styles
    useEffect(() => {
        setMapKey(prev => prev + 1);
    }, [satelliteData, mode]);

    // Data lookup maps for quick styling
    const ndviMap = new Map<string, number>();
    const floodedMap = new Map<string, any>();

    if (satelliteData) {
        // Handle both legacy (flat array) and new ({ summary, results }) formats
        const dataArray = Array.isArray(satelliteData) ? satelliteData : (satelliteData.results || []);
        
        if (mode === 'NDVI') {
            dataArray.forEach((d: any, i: number) => {
                if (i === 0) console.log("Sample NDVI satellite point UUID:", d.ポリゴンUUID);
                if (d.ndvi_mean !== null) ndviMap.set(d.ポリゴンUUID, d.ndvi_mean);
            });
        } else if (mode === 'Flooded') {
            dataArray.forEach((d: any, i: number) => {
                if (i === 0) console.log("Sample Flooded satellite point UUID:", d.ポリゴンUUID);
                floodedMap.set(d.ポリゴンUUID, d);
            });
        }
    }

    // --- Styling Functions ---
    // 5-step discrete palette matching get_sentinel.py PNG output
    const getNdviColor = (ndvi: number) => {
        if (ndvi < 0.30) return '#ffffbf';
        if (ndvi < 0.50) return '#cceb89';
        if (ndvi < 0.65) return '#91cf60';
        if (ndvi < 0.80) return '#40a947';
        return '#1a9641';
    };

    const styleFeature = (feature: any) => {
        const uuid = feature.properties.polygon_uuid || feature.properties.id || feature.properties["ポリゴンUUID"];
        
        let fillColor = '#3388ff'; // default Leaflet blue
        let fillOpacity = 0.2;
        let color = '#3388ff'; // border
        let weight = 2;

        if (mode === 'NDVI' && ndviMap.has(uuid)) {
            const ndvi = ndviMap.get(uuid)!;
            fillColor = getNdviColor(ndvi);
            fillOpacity = 0.7;
            color = 'white';
            weight = 0.5;
        } else if (mode === 'Flooded' && floodedMap.has(uuid)) {
            const fData = floodedMap.get(uuid)!;
            fillColor = fData.is_flooded ? '#3b82f6' : '#fed7aa'; // Blue or light orange
            fillOpacity = 0.6;
            color = 'white';
            weight = 0.5;
        } else if (mode === 'TrueColor') {
            // In True Color, we might just want to see the polygons outlines clearly over the image
            fillOpacity = 0;
            color = '#fde047'; // Yellow outlines
            weight = 2;
        }

        return {
            fillColor,
            weight,
            opacity: 1,
            color,
            fillOpacity
        };
    };

    const bindPopup = (feature: any, layer: any) => {
        const uuid = feature.properties.polygon_uuid || feature.properties.id || feature.properties["ポリゴンUUID"] || feature.properties["uuid"];
        const name = feature.properties.name || Object.values(feature.properties).find((v:any) => typeof v === 'string' && v.includes('field')) || `Field ${uuid}`;
        
        if (!(window as any).hasLoggedFeature) {
            console.log("Sample GeoJSON feature properties:", feature.properties);
            console.log("Determined UUID for mapping:", uuid);
            (window as any).hasLoggedFeature = true;
        }

        // Remove existing tooltip to update
        if (layer.unbindTooltip) {
            layer.unbindTooltip();
        }

        layer.on('click', async () => {
            if (mode === 'NDVI' && selectedCity && activeDate) {
                try {
                    const meshData = await loadNdviMeshPng(selectedCity, selectedDb, activeDate, uuid);
                    if (meshData) {
                        const blob = new Blob([meshData.buffer], { type: 'image/png' });
                        const url = URL.createObjectURL(blob);
                        // Revoke previous URL (if any) before setting new overlay to avoid memory leaks
                        setMeshOverlay(prev => {
                            if (prev?.url) URL.revokeObjectURL(prev.url);
                            return { url, bounds: meshData.bounds };
                        });
                    } else {
                        if (meshOverlay?.url) URL.revokeObjectURL(meshOverlay.url);
                        setMeshOverlay(null);
                    }
                } catch (e) {
                    console.error("Failed to load mesh overlay", e);
                    if (meshOverlay?.url) URL.revokeObjectURL(meshOverlay.url);
                    setMeshOverlay(null);
                }
            }
        });

        const fieldData = userDb ? userDb[uuid] : null;

        const varietyId = fieldData?.varietyId;
        const varietyName = varietyId && varieties ? varieties.find(v => v.id === varietyId)?.name || 'Unknown' : 'Unknown';
        const transplantDate = fieldData?.transplantDate || '-';
        const headingDate = fieldData?.headingDate || '-';
        const headingStatus = fieldData?.headingStatus || '';
        const ndviVal = (mode === 'NDVI' && ndviMap.has(uuid)) ? ndviMap.get(uuid)!.toFixed(3) : '-';
        const floodedData = (mode === 'Flooded' && floodedMap.has(uuid)) ? floodedMap.get(uuid) : null;

        // Build mode-specific rows
        let modeRows = '';
        if (mode === 'NDVI') {
            modeRows = `<tr><td class="pr-2 text-gray-500 pt-1">NDVI:</td><td class="font-bold text-green-700 pt-1">${ndviVal}</td></tr>`;
        } else if (mode === 'Flooded' && floodedData) {
            const statusText = floodedData.is_flooded 
                ? '<span class="text-blue-600 font-bold">湛水あり</span>' 
                : '<span class="text-orange-500">未入水</span>';
            const areaText = floodedData.area_ha ? `${floodedData.area_ha.toFixed(2)} ha` : '-';
            // Show different detail based on sub-mode (MNDWI vs SAR)
            let detailRow = '';
            if (floodedSubMode === 'SAR_Flooded' && floodedData.mean_db != null) {
                detailRow = `<tr><td class="pr-2 text-gray-500">平均dB:</td><td class="font-medium">${floodedData.mean_db.toFixed(1)} dB</td></tr>`;
            } else if (floodedData.water_ratio != null) {
                const waterPct = (floodedData.water_ratio * 100).toFixed(0);
                detailRow = `<tr><td class="pr-2 text-gray-500">水面率:</td><td class="font-medium">${waterPct}%</td></tr>`;
            }
            modeRows = `
                <tr><td class="pr-2 text-gray-500 pt-1">湛水:</td><td class="pt-1">${statusText}</td></tr>
                ${detailRow}
                <tr><td class="pr-2 text-gray-500">面積:</td><td class="font-medium">${areaText}</td></tr>`;
        }

        let tooltipContent = `<div class="text-xs p-1">
            <strong class="block border-b pb-1 mb-2 text-sm">${name}</strong>
            <table class="w-full text-left">
                <tbody>
                    <tr><td class="pr-2 text-gray-500">品種:</td><td class="font-medium">${varietyName}</td></tr>
                    <tr><td class="pr-2 text-gray-500">移植期:</td><td class="font-medium">${transplantDate}</td></tr>
                    <tr>
                        <td class="pr-2 text-gray-500">出穂期:</td>
                        <td class="font-medium">
                            ${headingDate} 
                            ${headingStatus ? `<span class="ml-1 bg-gray-100 px-1 rounded text-[10px] text-gray-600 border border-gray-200">${headingStatus}</span>` : ''}
                        </td>
                    </tr>
                    ${modeRows}
                </tbody>
            </table>
        </div>`;

        layer.bindTooltip(tooltipContent, { sticky: true, className: 'bg-white bg-opacity-95 shadow-md border border-gray-200 rounded', direction: 'auto' });
    };

    const onEachFeature = (feature: any, layer: L.Layer) => {
        bindPopup(feature, layer);
    };

    // Reset log tracker when geojsondata changes so we can log again on new city
    useEffect(() => {
        (window as any).hasLoggedFeature = false;
    }, [geojsonData]);

    return (
        <div className="relative w-full h-full">
            {/* UI Controls Overlay */}
            <div className="absolute bottom-6 left-4 z-[400] flex flex-col gap-2 items-start">
                <MapTypeControl mapType={mapType} setMapType={setMapType} />
            </div>

            <MapContainer 
                key={mapKey}
                center={[36.3, 140.3]} 
                zoom={9} 
                style={{ height: '100%', width: '100%', zIndex: 0 }}
            >
                {/* 背景（ポリゴン以外の場所）クリックでメッシュオーバーレイを消す */}
                <MapClickHandler
                    clearOverlay={() => {
                        setMeshOverlay(prev => {
                            if (prev?.url) URL.revokeObjectURL(prev.url);
                            return null;
                        });
                    }}
                />
                {mapType === 'street' ? (
                    <TileLayer
                        key="street"
                        attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
                        url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
                    />
                ) : (
                    <TileLayer
                        key="satellite"
                        attribution='&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">国土地理院</a>'
                        url="https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg"
                    />
                )}
                
                {geojsonData && (
                    <MapBoundsUpdater geojsonData={geojsonData} activeDate={activeDate} selectedDb={selectedDb} />
                )}
                
                {mode === 'TrueColor' && <TiffLayer key={tiffKey} tiffBuffer={tiffBuffer} mode={mode} />}

                {mode !== 'TrueColor' && geojsonData && (
                    <GeoJSON 
                        data={geojsonData} 
                        style={styleFeature}
                        onEachFeature={onEachFeature}
                    />
                )}

                {meshOverlay && (
                    <ImageOverlay
                        url={meshOverlay.url}
                        bounds={meshOverlay.bounds}
                        opacity={1.0}
                        zIndex={500}
                    />
                )}
            </MapContainer>
        </div>
    );
}
