import { useState, useEffect } from 'react';
import { useFileSystemContext } from '@/contexts/FileSystemContext';
import { VarietyParams } from '@/lib/logic/types';
import { BASE_VARIETY_IDS } from '@/lib/varieties';

const EMPTY_VARIETY: VarietyParams = {
    id: '',
    name: '',
    gv: 0,
    th: 0,
    lc: 0,
    a: 0,
    b: 0,
    tmax: 1000,
    dvs_star: 0.5,
    Adj: 0,
    DVS: 0.2,
    color: '#000000',
    baseVarietyId: ''
};

export default function VarietySettings() {
    const { varieties, saveVarieties, directoryHandle } = useFileSystemContext();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<VarietyParams>(EMPTY_VARIETY);
    const [status, setStatus] = useState<string>('');

    // If editingId changes, populate form
    useEffect(() => {
        if (editingId === null) {
            setFormData(EMPTY_VARIETY);
        } else {
            const target = varieties.find(v => v.id === editingId);
            if (target) {
                setFormData({ ...target });
            }
        }
    }, [editingId, varieties]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }));
    };

    const handleSave = async () => {
        if (!formData.name) {
            setStatus('品種名を入力してください。');
            return;
        }

        // Auto-assign ID to be the same as the name
        const varietyId = formData.name;
        const isBaseVariety = BASE_VARIETY_IDS.includes(varietyId);

        // Require baseVarietyId for non-base varieties
        if (!isBaseVariety && !formData.baseVarietyId) {
            setStatus('基準品種を選択してください。');
            return;
        }

        const varietyToSave = { 
            ...formData, 
            id: varietyId,
            // Clear baseVarietyId for base varieties (they are their own base)
            baseVarietyId: isBaseVariety ? undefined : formData.baseVarietyId
        };

        const newVarieties = [...varieties];
        const existingIndex = newVarieties.findIndex(v => v.id === varietyId);

        if (editingId) {
            // Update
            if (existingIndex >= 0 && newVarieties[existingIndex].id !== editingId) {
                 setStatus('この品種名はすでに存在するため変更できません。');
                 return;
            }
            // If we are editing, we find the original by editingId and update it
             const targetIndex = newVarieties.findIndex(v => v.id === editingId);
             if (targetIndex >= 0) {
                 newVarieties[targetIndex] = varietyToSave;
             }
        } else {
            // Create
            if (existingIndex >= 0) {
                setStatus('この品種名はすでに存在します。');
                return;
            }
            newVarieties.push(varietyToSave);
        }

        try {
            await saveVarieties(newVarieties);
            setStatus('保存しました。');
            setEditingId(null);
            setFormData(EMPTY_VARIETY);
        } catch (e: any) {
            setStatus(`保存エラー: ${e.message}`);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('本当にこの品種を削除しますか？')) return;
        const newVarieties = varieties.filter(v => v.id !== id);
        try {
            await saveVarieties(newVarieties);
            setStatus('削除しました。');
        } catch (e: any) {
            setStatus(`削除エラー: ${e.message}`);
        }
    };

    if (!directoryHandle) {
         return (
             <div className="p-8 text-center">
                 <p className="text-red-600 font-bold">最初にメインページでデータフォルダを選択してください。</p>
             </div>
         );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <header className="mb-8 flex justify-between items-center">
                <div>
                     <h1 className="text-2xl font-bold text-gray-800">品種設定 (Variety Settings)</h1>
                </div>
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded">
                    {varieties.length} 品種読み込み済み
                </div>
            </header>

            {status && <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">{status}</div>}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* List Column */}
                <div className="lg:col-span-2 bg-white rounded shadow p-4 overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-700">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-4 py-2">カラー</th>
                                <th className="px-4 py-2">品種名</th>
                                <th className="px-4 py-2">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {varieties.map(v => (
                                <tr key={v.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-2">
                                        <div className="w-6 h-6 rounded border border-gray-300" style={{ backgroundColor: v.color || '#cccccc' }}></div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col">
                                            <span className="font-bold">{v.name}</span>
                                            {BASE_VARIETY_IDS.includes(v.id) ? (
                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold w-fit mt-0.5">基準</span>
                                            ) : v.baseVarietyId ? (
                                                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded w-fit mt-0.5">← {v.baseVarietyId}</span>
                                            ) : null}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 flex gap-2">
                                        <button 
                                            onClick={() => setEditingId(v.id)}
                                            className="text-blue-600 hover:text-blue-800 font-bold"
                                        >
                                            編集
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(v.id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Form Column */}
                <div className="bg-white rounded shadow p-4 lg:sticky lg:top-4 h-fit">
                    <h2 className="text-lg font-bold mb-4 text-gray-800">
                        {editingId ? '品種の編集' : '新しい品種の追加'}
                    </h2>
                    
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Name (品種名)</label>
                                <input 
                                    type="text" name="name"
                                    value={formData.name} onChange={handleChange}
                                    disabled={!!editingId && formData.name === editingId}
                                    className="w-full p-2 border border-gray-300 rounded text-sm text-black font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-600"
                                    placeholder="例: コシヒカリ"
                                />
                                {editingId && formData.name === editingId && (
                                    <p className="text-[10px] text-gray-500 mt-1">※既存品種の名前は変更できません。</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">表示カラー (Display Color)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color" name="color"
                                    value={formData.color || '#000000'} onChange={handleChange}
                                    className="h-8 w-16 p-0 border-0 rounded cursor-pointer"
                                />
                                <span className="text-xs text-gray-500">{formData.color}</span>
                            </div>
                        </div>

                        <hr className="my-2" />
                        <h3 className="text-xs font-bold text-gray-500 uppercase">基本設定</h3>

                        <div className="space-y-4 mt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">基準品種</label>
                                {editingId && BASE_VARIETY_IDS.includes(editingId) ? (
                                    <div className="bg-blue-50 text-blue-700 p-2 rounded text-xs font-bold">
                                        この品種はオリジナル基準品種のため、基準品種の選択は不要です。
                                    </div>
                                ) : (
                                    <>
                                        <select 
                                            className="bg-white p-1 rounded shadow-lg flex space-x-1 font-bold text-black border border-gray-400 focus:ring-2 focus:ring-blue-500 outline-none w-full"
                                            value={formData.baseVarietyId || ''}
                                            onChange={(e) => {
                                                const baseId = e.target.value;
                                                const base = varieties.find(v => v.id === baseId);
                                                if (base) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        baseVarietyId: baseId,
                                                        gv: base.gv,
                                                        th: base.th,
                                                        lc: base.lc,
                                                        a: base.a,
                                                        b: base.b,
                                                        dvs_star: base.dvs_star,
                                                        DVS: base.DVS,
                                                        Adj: base.Adj,
                                                        tmax: base.tmax
                                                    }));
                                                }
                                            }}
                                        >
                                            <option value="">-- 基準品種を選択 --</option>
                                            {varieties.filter(v => BASE_VARIETY_IDS.includes(v.id)).map(v => (
                                                <option key={`base-${v.id}`} value={v.id}>{v.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-gray-500 mt-1">※選択した品種の生育モデル（生長パラメータ）をコピーします。</p>
                                    </>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">出穂期オフセット (日)</label>
                                    <input 
                                        type="number" step="1" name="Adj"
                                        value={formData.Adj || 0} onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">ベース品種の出穂から±何日か (例: +5, -3)</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">成熟期積算気温 (℃)</label>
                                    <input 
                                        type="number" step="1" name="tmax"
                                        value={formData.tmax || 0} onChange={handleChange}
                                        className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-black focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">出穂から成熟までの必要積算気温</p>
                                </div>
                            </div>
                        </div>

                        {/* Hidden advanced parameters to preserve them in form data */}
                        <details className="mt-4 border border-gray-200 rounded p-2 bg-gray-50">
                            <summary className="text-xs font-bold text-gray-600 cursor-pointer outline-none">詳細パラメータ設定 (通常は変更不要)</summary>
                            <div className="grid grid-cols-2 gap-2 mt-3">
                             {/* Number Fields Helper */}
                             {[
                                 { label: 'gv (Grain Filling)', name: 'gv' },
                                 { label: 'th (Base Temp)', name: 'th' },
                                 { label: 'lc (Crit Daylen)', name: 'lc' },
                                 { label: 'a (Temp Coeff)', name: 'a' },
                                 { label: 'b (Daylen Coeff)', name: 'b' },
                                 { label: 'dvs_star (Crit DVS)', name: 'dvs_star' },
                                 { label: 'DVS (Init)', name: 'DVS' },
                             ].map(field => (
                                 <div key={field.name}>
                                     <label className="block text-[10px] font-bold text-gray-500 mb-1">{field.label}</label>
                                     <input 
                                         type="number" step="0.0001" name={field.name}
                                         value={formData[field.name as keyof VarietyParams] || 0} onChange={handleChange}
                                         className="w-full p-1 border rounded text-xs bg-white text-gray-600"
                                     />
                                 </div>
                             ))}
                            </div>
                        </details>

                        <div className="flex gap-2 mt-4 pt-4 border-t">
                             {editingId && (
                                 <button 
                                    onClick={() => setEditingId(null)}
                                    className="flex-1 bg-gray-500 text-white py-2 rounded text-sm font-bold"
                                 >
                                     キャンセル
                                 </button>
                             )}
                             <button 
                                onClick={handleSave}
                                className="flex-1 bg-green-600 text-white py-2 rounded text-sm font-bold hover:bg-green-700"
                             >
                                 {editingId ? '更新' : '作成'}
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
