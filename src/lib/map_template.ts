export const MAP_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Map Export</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
        body { margin: 0; font-family: sans-serif; }
        #map { height: 100vh; }
        .legend { padding: 6px 8px; font: 14px/16px Arial, Helvetica, sans-serif; background: white; background: rgba(255,255,255,0.8); box-shadow: 0 0 15px rgba(0,0,0,0.2); border-radius: 5px; line-height: 1.5; max-height: 300px; overflow-y: auto; }
        .legend h4 { margin: 0 0 5px; color: #333; }
        .legend-item { display: flex; align-items: center; }
        .legend-color { width: 18px; height: 18px; float: left; margin-right: 8px; opacity: 0.9; border: 1px solid #ccc; }
        #controls { position: absolute; top: 10px; right: 10px; z-index: 800; background: white; padding: 10px; border-radius: 5px; box-shadow: 0 0 15px rgba(0,0,0,0.2); }
        #controls h4 { margin: 0 0 5px; }
        #map-type-controls button { padding: 5px 10px; border: 1px solid #ccc; background: #f8f8f8; cursor: pointer; }
        #map-type-controls button.active { background: #007bff; color: white; border-color: #007bff; }
    </style>
</head>
<body>
    <div id="map"></div>
    <div id="controls">
        <div id="map-type-controls" style="margin-bottom: 10px;">
            <h4>地図表示</h4>
            <button id="street-map-btn">標準</button>
            <button id="satellite-map-btn" class="active">衛星</button>
        </div>
        <h4>色分け表示</h4>
        <div id="radio-buttons-container"></div>
    </div>

    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
        document.addEventListener("DOMContentLoaded", function() {
            if (typeof L === 'undefined') {
                alert('地図ライブラリ(Leaflet)の読み込みに失敗しました。ネットワーク接続を確認するか、しばらくしてから再度お試しください。');
                return;
            }

            const geojsonData = __GEOJSON_DATA__;
            const injectedVarietyColors = __VARIETY_COLORS__;
            const choroplethOptions = __CHOROPLETH_OPTIONS__;
            const map = L.map('map');

            // --- Map Layers ---
            const streetLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">\u56fd\u571f\u5730\u7406\u9662</a>'
            });
            const satelliteLayer = L.tileLayer('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', {
                attribution: '&copy; <a href="https://maps.gsi.go.jp/development/ichiran.html">\u56fd\u571f\u5730\u7406\u9662</a>'
            });
            
            satelliteLayer.addTo(map); // Default layer

            // Dynamically generate radio buttons
            const radioContainer = document.getElementById('radio-buttons-container');
            if (radioContainer && choroplethOptions) {
                let radioHTML = '';
                radioHTML += '<input type="radio" name="choropleth" id="default" value="default" checked> <label for="default">デフォルト</label><br>';
                radioHTML += '<input type="radio" name="choropleth" id="variety" value="variety"> <label for="variety">品種</label><br>';
                choroplethOptions.forEach(option => {
                    radioHTML += \`<input type="radio" name="choropleth" id="\${option.value}" value="\${option.value}"> <label for="\${option.value}">\${option.label}</label><br>\`;
                });
                radioContainer.innerHTML = radioHTML;
            }
            let activeChoropleth = 'default';
            let geojsonLayer;
            const choroplethData = {};
            const varietyColorMap = new Map();

            const lerpColor = (a, b, amount) => {
                const ah = parseInt(a.replace(/#/g, ''), 16), ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff;
                const bh = parseInt(b.replace(/#/g, ''), 16), br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff;
                const rr = ar + amount * (br - ar), rg = ag + amount * (bg - ag), rb = ab + amount * (bb - ab);
                return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + (rb | 0)).toString(16).slice(1);
            };

            const stringToColor = (str) => {
                if (!str) return '#cccccc';
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = str.charCodeAt(i) + ((hash << 5) - hash);
                }
                let color = '#';
                for (let i = 0; i < 3; i++) {
                    const value = (hash >> (i * 8)) & 0xFF;
                    color += ('00' + value.toString(16)).substr(-2);
                }
                return color;
            };

            const preprocessData = () => {
                const varieties = new Set();
                const values = {};
                choroplethOptions.forEach(option => {
                    values[option.value] = [];
                });

                geojsonData.features.forEach(f => {
                    const props = f.properties;
                    if (!props) return;
                    if (props.品種) varieties.add(props.品種);

                    choroplethOptions.forEach(option => {
                        const key = option.label; // Use LABEL as key in formatted data (e.g. '出穂期')
                        
                        // WARNING: formatted rows use Japanese labels as keys!
                        // In template, we might need to adjust accessing props.
                        const value = props[key];

                        if (value != null && value !== '') {
                            let numericValue;
                            if (key.includes('期') || key.includes('日')) {
                                const dateStr = value.length === 5 ? '2000-' + value : value;
                                numericValue = new Date(dateStr).getTime();
                            } else {
                                numericValue = parseFloat(value);
                            }

                            if (!isNaN(numericValue)) {
                                values[option.value].push(numericValue);
                            }
                        }
                    });
                });
                
                // Calculate ranges
                choroplethOptions.forEach(option => {
                     const key = option.value;
                     // CAREFUL WITHOUT MAPPING:
                     // The loop above pushed to values[option.value]
                     // We need to make sure we use correct keys.
                     // Option.value is English (headingDate)? Option.label is Japanese (出穂期).
                     // Formatted data has Japanese Keys.
                     // Let's ensure consistency.
                     
                     if (values[key] && values[key].length > 0) {
                         const min = Math.min(...values[key]);
                         const max = Math.max(...values[key]);
                         choroplethData[key] = { min, max, range: max - min };
                     }
                });

                const varietiesInGeoJSON = Array.from(varieties).sort();
                varietiesInGeoJSON.forEach(variety => {
                    if (injectedVarietyColors && injectedVarietyColors[variety]) {
                        varietyColorMap.set(variety, injectedVarietyColors[variety]);
                    } else {
                        varietyColorMap.set(variety, stringToColor(variety)); // Fallback
                    }
                });
            };

            const styleFeature = (feature) => {
                const props = feature.properties;
                const defaultStyle = { weight: 1, opacity: 1, color: 'white', fillOpacity: 0.7, fillColor: '#888888' };
                if (!props) return defaultStyle;

                if (activeChoropleth === 'default') {
                    return defaultStyle;
                }
                if (activeChoropleth === 'variety') {
                    return { ...defaultStyle, fillColor: varietyColorMap.get(props.品種) || '#cccccc' };
                }

                const data = choroplethData[activeChoropleth];
                if (data) {
                    // Mapping: activeChoropleth is 'headingDate' etc.
                    // We need to look up corresponding property in Feature.
                    // Feature properties keys are Japanese (e.g. '出穂期').
                    // We need to find the label for this activeChoropleth value.
                    const option = choroplethOptions.find(opt => opt.value === activeChoropleth);
                    const key = option ? option.label : activeChoropleth; 
                    
                    const value = props[key];
                    
                    let numericValue = null;
                    if (key.includes('期') || key.includes('日')) {
                        const dateStr = (value && value.length === 5) ? '2000-' + value : value;
                        numericValue = value ? new Date(dateStr).getTime() : null;
                    } else {
                        numericValue = (value != null && value !== '') ? parseFloat(value) : null;
                    }

                    if (numericValue !== null && !isNaN(numericValue)) {
                        const amount = data.range === 0 ? 0.5 : (numericValue - data.min) / data.range;
                        let colorA = '#0000ff'; // blue
                        let colorB = '#ff0000'; // red
                        if (activeChoropleth.includes('maturity')) {
                            colorA = '#00ff00'; // green
                            colorB = '#ffff00'; // yellow
                        } else if (activeChoropleth.includes('met26')) {
                            colorA = '#00ff00'; // green
                            colorB = '#ff0000'; // red
                        }
                        return { ...defaultStyle, fillColor: lerpColor(colorA, colorB, amount) };
                    }
                }
                
                return defaultStyle;
            };

            const onEachFeature = (feature, layer) => {
                const props = feature.properties;
                if (!props) return;
                let tooltipContent = '';
                tooltipContent += \`ID: \${props['ポリゴンUUID'] || ''}\`;
                tooltipContent += \`<br>品種: \${props['品種'] || ''}\`;
                
                choroplethOptions.forEach(option => {
                    const key = option.label;
                    const value = props[key];
                    if (value != null && value !== '') {
                        let displayValue = value;
                        tooltipContent += \`<br>\${key}: \${displayValue}\`;
                    }
                });

                if (props['備考']) tooltipContent += \`<br>備考: \${props['備考']}\`;
                layer.bindTooltip(tooltipContent);
            };

            const legend = L.control({ position: 'bottomright' });
            legend.onAdd = function(map) { return L.DomUtil.create('div', 'info legend'); };
            legend.addTo(map);

            const updateLegend = () => {
                const div = legend.getContainer();
                div.innerHTML = '';
                const data = choroplethData[activeChoropleth];
                if (activeChoropleth === 'default') return;

                let title = '';
                if (activeChoropleth === 'variety') {
                    title = '品種';
                } else {
                    const option = choroplethOptions.find(opt => opt.value === activeChoropleth);
                    if (option) {
                        title = option.label;
                    }
                }
                div.innerHTML = \`<h4>\${title}</h4>\`;

                if (activeChoropleth === 'variety') {
                    varietyColorMap.forEach((color, name) => {
                        div.innerHTML += \`<div class="legend-item"><div class="legend-color" style="background:\${color}"></div><span>\${name}</span></div>\`;
                    });
                } else if (data) {
                    const grades = 5;
                    const step = data.range / grades;
                    for (let i = 0; i < grades; i++) {
                        const from = data.min + (step * i);
                        const to = data.min + (step * (i + 1));
                        const amount = (i + 0.5) / grades;
                        
                        let colorA = '#0000ff'; // blue
                        let colorB = '#ff0000'; // red
                        if (activeChoropleth.includes('maturity')) {
                            colorA = '#00ff00'; // green
                            colorB = '#ffff00'; // yellow
                        } else if (activeChoropleth.includes('met26')) {
                            colorA = '#00ff00'; // green
                            colorB = '#ff0000'; // red
                        }
                        const color = lerpColor(colorA, colorB, amount);

                        const isDate = activeChoropleth.includes('Date') || activeChoropleth.includes('date');
                        const formatDateLabel = (ms) => {
                            const d = new Date(ms);
                            return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
                        };
                        let fromLabel = isDate ? formatDateLabel(from) : from.toFixed(1);
                        let toLabel = isDate ? formatDateLabel(to) : to.toFixed(1);
                        div.innerHTML += \`<div class="legend-item"><div class="legend-color" style="background:\${color}"></div><span>\${fromLabel} &ndash; \${toLabel}</span></div>\`;
                    }
                }
                div.innerHTML += '<div class="legend-item"><div class="legend-color" style="background:#cccccc"></div><span>データなし</span></div>';
            };

            if (geojsonData && geojsonData.features) {
                preprocessData();
                geojsonLayer = L.geoJSON(geojsonData, { style: styleFeature, onEachFeature: onEachFeature }).addTo(map);
                if (geojsonLayer.getBounds().isValid()) map.fitBounds(geojsonLayer.getBounds());
                updateLegend();
            } else {
                map.setView([36.3, 140.4], 8);
                alert('表示する地理データがありません。');
            }

            document.querySelectorAll('input[name="choropleth"]').forEach(radio => {
                radio.addEventListener('change', (event) => {
                    activeChoropleth = event.target.value;
                    geojsonLayer.setStyle(styleFeature);
                    updateLegend();
                });
            });

            // --- Map Type Switching Logic ---
            const streetBtn = document.getElementById('street-map-btn');
            const satelliteBtn = document.getElementById('satellite-map-btn');

            streetBtn.addEventListener('click', () => {
                if (!map.hasLayer(streetLayer)) {
                    map.removeLayer(satelliteLayer);
                    map.addLayer(streetLayer);
                    streetBtn.classList.add('active');
                    satelliteBtn.classList.remove('active');
                }
            });

            satelliteBtn.addEventListener('click', () => {
                if (!map.hasLayer(satelliteLayer)) {
                    map.removeLayer(streetLayer);
                    map.addLayer(satelliteLayer);
                    satelliteBtn.classList.add('active');
                    streetBtn.classList.remove('active');
                }
            });
        });
    </script>
</body>
</html>`;
