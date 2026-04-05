

interface AboutModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-green-700 text-white p-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold">システム概要・クレジット (About)</h2>
                    <button 
                        onClick={onClose}
                        className="text-white hover:text-gray-200 transition p-1"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="p-6 overflow-y-auto flex-1 text-gray-800 text-sm">
                    <div className="mb-6 border-b pb-4">
                        <h3 className="text-lg font-bold text-green-800 mb-2">水稲生育予測システム</h3>
                        <p className="mb-2">
                            本システムは、インターネットブラウザ上で動作する水稲生育予測アプリケーションです。外部のクラウドサーバー等を介さず、お使いのPCローカル環境内でデータ処理・保存が完結するため、機密性の高い圃場データ等を安全に管理しながら、生育予測計算や衛星画像（NDVI/入水状況）の確認を行うことができます。
                            （※地図の基本描画や、事前のデータ取得にはインターネット接続が必要です）
                        </p>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-base mb-2 border-l-4 border-green-600 pl-2">使用した農研機構著作物</h4>
                        <ul className="space-y-3 list-none pl-1">
                            <li className="bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-blue-800">〇 TriCroParasol（機構-ZC25）</span><br/>
                                出穂予測式の係数推定に使用しました。<br/>
                                <a href="https://www.naro.go.jp/collab/program/laboratory/rcait/163312.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">https://www.naro.go.jp/collab/program/laboratory/rcait/163312.html</a>
                            </li>
                            <li className="bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-blue-800">〇 農研機構メッシュ農業気象データ</span><br/>
                                上記プログラムを用いた係数推定のための気象データとして使用しました。<br/>
                                <a href="https://amu.rd.naro.go.jp/wiki_open/doku.php?id=start" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">https://amu.rd.naro.go.jp/wiki_open/doku.php?id=start</a>
                            </li>
                        </ul>
                    </div>

                    <div className="mb-6">
                        <h4 className="font-bold text-base mb-2 border-l-4 border-emerald-600 pl-2">参考文献</h4>
                        <ul className="space-y-3 list-none pl-1">
                            <li className="bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-gray-800">〇 イネの発育過程のモデル化と予測に関する研究 : 第1報 モデルの基本構造とパラメータの推定法および出穂予測への適用</span><br/>
                                堀江武・中川博視（平成2 年）<br/>
                                出穂期予測の予測式として適用しました。<br/>
                                <a href="https://www.jstage.jst.go.jp/article/jcs1927/59/4/59_4_687/_article/-char/ja/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">https://www.jstage.jst.go.jp/article/jcs1927/59/4/59_4_687/_article/-char/ja/</a>
                            </li>
                            <li className="bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-gray-800">〇 有効積算温度と幼穂長による水稲の出穂期予測</span><br/>
                                茨城県農業研究所 主要成果<br/>
                                幼穂長からの出穂期予測の予測式として適用しました。<br/>
                                <a href="https://www.pref.ibaraki.jp/nourinsuisan/noken/seika/h16pdf/documents/3.pdf" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">https://www.pref.ibaraki.jp/nourinsuisan/noken/seika/h16pdf/documents/3.pdf</a>
                            </li>
                            <li className="bg-gray-50 p-3 rounded border border-gray-200">
                                <span className="font-bold text-gray-800">〇 Sentinel-2衛星データを用いた水田の取水開始時期の把握手法マニュアル</span><br/>
                                湛水状況進捗分析のためのMNDWI算出および入水判定処理の参考としました。<br/>
                                <a href="https://www.naro.go.jp/project/results/4th_laboratory/nire/2019/sentinel-2.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">https://www.naro.go.jp/project/results/4th_laboratory/nire/2019/sentinel-2.html</a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-bold text-base mb-2 border-l-4 border-indigo-500 pl-2">データソース</h4>
                        <ul className="space-y-2 list-disc pl-5">
                            <li><span className="font-bold">日平均気温・最高気温・最低気温・降水量</span>：アメダス気象データを使用しました。</li>
                            <li><span className="font-bold">マップタイル</span>：<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">国土地理院地図</a>を使用しました（標準地図・写真）。</li>
                        </ul>
                    </div>
                </div>
                
                <div className="border-t p-4 flex justify-end bg-gray-50">
                    <button 
                        onClick={onClose}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-6 rounded transition"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
