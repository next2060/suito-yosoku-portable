import { useState, useEffect, useRef } from 'react';
import { toPng } from 'html-to-image';
import { useFileSystemContext } from '@/contexts/FileSystemContext';
import { WeatherData } from '@/lib/logic/types';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

export default function WeatherViewer() {
    const { weatherPoints, loadWeatherData } = useFileSystemContext();
    const [selectedPoint, setSelectedPoint] = useState<string>(weatherPoints[0] || '');
    const [chartData, setChartData] = useState<WeatherData[]>([]);
    const [loading, setLoading] = useState(false);

    // For image export
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [downloading, setDownloading] = useState(false);
    const [isExportMode, setIsExportMode] = useState(false);

    const downloadImage = async () => {
        if (!chartContainerRef.current || chartData.length === 0) return;
        
        // Safety check: Ensure they are in export mode to prevent the -1 width bug
        if (!isExportMode) {
            alert('まず「保存用サイズに固定」にチェックを入れてください。');
            return;
        }

        setDownloading(true);

        try {
            const dataUrl = await toPng(chartContainerRef.current, {
                backgroundColor: '#ffffff',
                pixelRatio: 1.5, // slightly higher res for sharpness
                width: 1200,
                height: 900, // Change from 750 to 900 for a 4:3 aspect ratio better suited for A4 portrait
                style: {
                    margin: '0',
                    fontFamily: 'sans-serif'
                }
            });
            
            const link = document.createElement('a');
            link.download = `weather_${selectedPoint}.png`;
            if (dataUrl.length < 100) throw new Error("Generated image is empty");
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Failed to capture image', error);
            alert('画像の出力に失敗しました。');
        } finally {
            setDownloading(false);
        }
    };

    // Visibility toggles for 8 data series
    const [visible, setVisible] = useState({
        temp_act: true,
        temp_avg: true,
        max_act: true,
        max_avg: false,
        min_act: true,
        min_avg: false,
        precip_act: true,
        precip_avg: false,
    });

    const toggleVisibility = (key: keyof typeof visible) => {
        setVisible(prev => ({ ...prev, [key]: !prev[key] }));
    };

    useEffect(() => {
        if (!selectedPoint) return;
        let isMounted = true;
        setLoading(true);

        loadWeatherData(selectedPoint).then(data => {
            if (isMounted) {
                // Determine if a point is "act" or "avg" for the tooltip
                const processed = data.map(d => ({
                    ...d,
                    dateLabel: d.date.substring(5), // Keep only MM-DD for axis
                }));
                setChartData(processed);
                setLoading(false);
            }
        }).catch(err => {
            console.error("Error loading weather data for chart:", err);
            if (isMounted) setLoading(false);
        });

        return () => { isMounted = false; };
    }, [selectedPoint, loadWeatherData]);

    // Custom Tooltip to clearly show Actual vs Average
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-gray-300 rounded shadow-lg text-sm">
                    <p className="font-bold text-black text-base mb-2 border-b border-gray-200 pb-1">{label}</p>
                    {payload.map((entry: any, index: number) => {
                        let name = entry.name;
                        let val = Number(entry.value).toFixed(1);
                        let unit = entry.dataKey.includes('precip') ? 'mm' : '℃';

                        return (
                            <div key={index} className="flex justify-between space-x-4">
                                <span style={{ color: entry.color, fontWeight: 'bold' }}>{name}</span>
                                <span className="font-bold text-black">{val} {unit}</span>
                            </div>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full bg-gray-50 p-4">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4 flex items-center space-x-4">
                <label className="font-extrabold text-sm text-black">アメダス観測所:</label>
                <select
                    className="border border-gray-400 rounded p-2 text-sm bg-white min-w-[150px] font-bold text-black"
                    value={selectedPoint}
                    onChange={(e) => setSelectedPoint(e.target.value)}
                >
                    {weatherPoints.map(p => (
                        <option key={p} value={p}>{p}</option>
                    ))}
                </select>
                
                <div className="flex-1 flex flex-wrap items-center gap-x-4 gap-y-2 ml-4 border-l pl-4 border-gray-300">
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.temp_act} onChange={() => toggleVisibility('temp_act')} /><span className="text-blue-600 font-bold">平均(実)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.temp_avg} onChange={() => toggleVisibility('temp_avg')} /><span className="text-blue-300">平均(平)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.max_act} onChange={() => toggleVisibility('max_act')} /><span className="text-red-500 font-bold">最高(実)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.max_avg} onChange={() => toggleVisibility('max_avg')} /><span className="text-red-300">最高(平)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.min_act} onChange={() => toggleVisibility('min_act')} /><span className="text-cyan-500 font-bold">最低(実)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.min_avg} onChange={() => toggleVisibility('min_avg')} /><span className="text-cyan-300">最低(平)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.precip_act} onChange={() => toggleVisibility('precip_act')} /><span className="text-blue-700 font-bold">降水(実)</span></label>
                    <label className="flex items-center space-x-1 cursor-pointer text-xs"><input type="checkbox" checked={visible.precip_avg} onChange={() => toggleVisibility('precip_avg')} /><span className="text-blue-300">降水(平)</span></label>
                </div>
                
                {/* Export Mode Toggle & Button */}
                <div className="ml-auto flex items-center space-x-3 bg-gray-100 p-2 rounded flex-shrink-0 border border-gray-200">
                    <label className="flex items-center space-x-2 cursor-pointer text-sm font-bold text-gray-700">
                        <input 
                            type="checkbox" 
                            checked={isExportMode} 
                            onChange={(e) => setIsExportMode(e.target.checked)} 
                            disabled={downloading}
                            className="form-checkbox h-4 w-4 text-green-600 rounded cursor-pointer"
                        />
                        <span>保存用サイズに固定</span>
                    </label>
                    <button
                        onClick={downloadImage}
                        disabled={downloading || chartData.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded text-sm transition-colors disabled:opacity-50 flex items-center"
                    >
                        {downloading ? "作成中..." : "📷 画像を保存"}
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 p-4 relative overflow-hidden">
                {loading && (
                    <div className="absolute inset-0 z-10 bg-white bg-opacity-70 flex items-center justify-center">
                        <span className="text-gray-500 font-bold">Lading data...</span>
                    </div>
                )}
                
                {!loading && chartData.length > 0 && (
                    <div className={`w-full h-full bg-white relative transition-all ${isExportMode ? 'overflow-auto' : ''}`}>
                        {/* =========================================
                            NORMAL VIEW (Responsive, scales with window)
                            ========================================= */}
                        {!isExportMode && (
                            // Use strict inline styles to prevent flexbox from collapsing the 0-height SVG parent
                            <div 
                                style={{ width: '100%', height: '100%', minHeight: 400, flex: 1 }} 
                                data-html2canvas-ignore="true"
                            >
                                <ResponsiveContainer width="100%" height="100%" minHeight={400} minWidth={300}>
                                    <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                        <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="dateLabel" tick={{ fontSize: 12, fill: '#666' }} tickMargin={10} />
                                        <YAxis yAxisId="temp" orientation="left" tick={{ fontSize: 12, fill: '#666' }} tickCount={10} domain={['auto', 'auto']} label={{ value: '温度 (℃)', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: '12px', fill: '#666' } }} />
                                        <YAxis yAxisId="precip" orientation="right" tick={{ fontSize: 12, fill: '#666' }} domain={[0, 150]} label={{ value: '降水量 (mm)', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: '12px', fill: '#666' } }} />
                                        
                                        <RechartsTooltip content={<CustomTooltip />} />
                                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '12px', paddingLeft: '20px' }} />
                                        
                                        {visible.max_act && <Line yAxisId="temp" type="monotone" dataKey="temp_max_act" name="最高気温(実)" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                                        {visible.max_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_max_avg" name="最高気温(平)" stroke="#fca5a5" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
                                        {visible.temp_act && <Line yAxisId="temp" type="monotone" dataKey="temp_act" name="平均気温(実)" stroke="#08f800ff" strokeWidth={3} dot={false} activeDot={{ r: 6 }} isAnimationActive={false} />}
                                        {visible.temp_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_avg" name="平均気温(平)" stroke="#93fda5ff" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
                                        {visible.min_act && <Line yAxisId="temp" type="monotone" dataKey="temp_min_act" name="最低気温(実)" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                                        {visible.min_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_min_avg" name="最低気温(平)" stroke="#67e8f9" strokeWidth={1.5} strokeDasharray="5 5" dot={false} isAnimationActive={false} />}
                                        {visible.precip_act && <Bar yAxisId="precip" dataKey="precip_act" name="降水量(実)" fill="#2563eb" opacity={0.8} barSize={4} isAnimationActive={false} />}
                                        {visible.precip_avg && <Bar yAxisId="precip" dataKey="precip_avg" name="降水量(平)" fill="#93c5fd" opacity={0.4} barSize={4} isAnimationActive={false} />}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* =========================================
                            EXPORT VIEW (Strictly 1200x750 pixels)
                            No ResponsiveContainer = No SVG collapse bugs.
                            ========================================= */}
                        {isExportMode && (
                            <div 
                                ref={chartContainerRef}
                                style={{ 
                                    width: '1200px', 
                                    height: '900px',
                                    backgroundColor: '#ffffff',
                                    padding: '30px', // Increased padding to fit larger fonts
                                    position: 'relative',
                                }}
                            >
                                <h2 className="text-3xl font-bold text-center mb-6 pb-2 text-gray-800 tracking-wide">
                                    気象データ ({selectedPoint})
                                </h2>

                                {/* Multiline Axis Titles rendered as HTML overlays to avoid SVG text strictness */}
                                <div style={{ position: 'absolute', top: '150px', left: '30px', width: '100px', textAlign: 'center', fontSize: '26px', fontWeight: '900', color: '#333', lineHeight: '1.2' }}>
                                    温度<br/>(℃)
                                </div>
                                <div style={{ position: 'absolute', top: '150px', right: '30px', width: '100px', textAlign: 'center', fontSize: '26px', fontWeight: '900', color: '#333', lineHeight: '1.2' }}>
                                    降水量<br/>(mm)
                                </div>

                                <ComposedChart
                                    width={1140} // 1200 - (30px padding * 2)
                                    height={810} // 900 - (30px padding * 2) - ~80px title header
                                    data={chartData}
                                    margin={{ top: 130, right: 30, bottom: 40, left: 10 }} // Huge top margin to fit Top Legend and Labels
                                >
                                    <CartesianGrid stroke="#e0e0e0" strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="dateLabel" tick={{ fontSize: 26, fill: '#333', fontWeight: 'bold' }} tickMargin={18} />
                                    
                                    {/* Left Y-Axis: Temperature - Positioned top left */}
                                    <YAxis 
                                        yAxisId="temp" 
                                        orientation="left" 
                                        tick={{ fontSize: 26, fill: '#333', fontWeight: 'bold' }} 
                                        tickCount={10} 
                                        domain={['auto', 'auto']} 
                                    />
                                    
                                    {/* Right Y-Axis: Precipitation - Positioned top right */}
                                    <YAxis 
                                        yAxisId="precip" 
                                        orientation="right" 
                                        tick={{ fontSize: 26, fill: '#333', fontWeight: 'bold' }} 
                                        domain={[0, 150]} 
                                    />
                                    
                                    <Legend layout="horizontal" verticalAlign="top" align="center" wrapperStyle={{ fontSize: '24px', paddingBottom: '20px', fontWeight: 'bold', width: '100%', left: 0 }} />
                                    
                                    {visible.max_act && <Line yAxisId="temp" type="monotone" dataKey="temp_max_act" name="最高気温(実)" stroke="#ef4444" strokeWidth={4} dot={false} activeDot={false} isAnimationActive={false} />}
                                    {visible.max_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_max_avg" name="最高気温(平)" stroke="#fca5a5" strokeWidth={2.5} strokeDasharray="6 6" dot={false} isAnimationActive={false} />}
                                    {visible.temp_act && <Line yAxisId="temp" type="monotone" dataKey="temp_act" name="平均気温(実)" stroke="#08f800ff" strokeWidth={5} dot={false} activeDot={false} isAnimationActive={false} />}
                                    {visible.temp_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_avg" name="平均気温(平)" stroke="#93fda5ff" strokeWidth={3} strokeDasharray="6 6" dot={false} isAnimationActive={false} />}
                                    {visible.min_act && <Line yAxisId="temp" type="monotone" dataKey="temp_min_act" name="最低気温(実)" stroke="#06b6d4" strokeWidth={4} dot={false} activeDot={false} isAnimationActive={false} />}
                                    {visible.min_avg && <Line yAxisId="temp" type="monotone" dataKey="temp_min_avg" name="最低気温(平)" stroke="#67e8f9" strokeWidth={2.5} strokeDasharray="6 6" dot={false} isAnimationActive={false} />}
                                    {visible.precip_act && <Bar yAxisId="precip" dataKey="precip_act" name="降水量(実)" fill="#2563eb" opacity={0.8} barSize={10} isAnimationActive={false} />}
                                    {visible.precip_avg && <Bar yAxisId="precip" dataKey="precip_avg" name="降水量(平)" fill="#93c5fd" opacity={0.4} barSize={10} isAnimationActive={false} />}
                                </ComposedChart>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
