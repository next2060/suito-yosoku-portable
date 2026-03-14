

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
                <h3 className="font-bold text-lg text-green-800 mb-2">Data Export</h3>
                <p className="text-xs text-gray-600 mb-4">
                    Exports all field data saved in the current DB, including latest predictions.
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleCsvExport}
                        disabled={isExporting}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                        {isExporting ? 'Exporting...' : 'Export CSV Dataset'}
                    </button>
                    
                    <button 
                        onClick={handleGeoJsonExport}
                        disabled={isExporting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                        {isExporting ? 'Exporting...' : 'Export GeoJSON'}
                    </button>

                    <button 
                        onClick={handleHtmlExport}
                        disabled={isExporting}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded transition disabled:opacity-50"
                    >
                         {isExporting ? 'Exporting...' : 'Export HTML Map'}
                    </button>
                    <p className="text-[10px] text-gray-500 mt-1">
                        HTML map includes interactive colored polygons based on predicted maturity dates.
                    </p>
                </div>
            </div>
        </div>
    );
}
