

interface ExportPanelProps {
    handleCsvExport: () => Promise<void>;
    handleGeoJsonExport: () => Promise<void>;
    handleHtmlExport: () => Promise<void>;
    isExporting: boolean;
}

export default function ExportPanel({
    handleCsvExport,
    handleGeoJsonExport,
    handleHtmlExport,
    isExporting
}: ExportPanelProps) {
    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded shadow border border-gray-200">
                <h3 className="font-bold text-lg text-green-800 mb-2">データ出力</h3>
                <p className="text-xs text-gray-600 mb-4">
                    選択した圃場の情報を出力します。
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleCsvExport}
                        disabled={isExporting}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                        {isExporting ? '出力中...' : 'CSV 出力'}
                    </button>
                    
                    <button 
                        onClick={handleGeoJsonExport}
                        disabled={isExporting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                        {isExporting ? '出力中...' : 'GeoJSON 出力'}
                    </button>

                    <button 
                        onClick={handleHtmlExport}
                        disabled={isExporting}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                         {isExporting ? '出力中...' : 'HTML マップ出力'}
                    </button>
                </div>
            </div>
        </div>
    );
}
