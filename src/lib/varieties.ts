import { VarietyParams } from './logic/types';

export const DEFAULT_VARIETIES: VarietyParams[] = [
    {
        id: 'あきたこまち',
        name: 'あきたこまち',
        gv: 64.7536,
        th: 15.6780,
        lc: 22.5680,
        a: 0.1800,
        b: 1.3252,
        tmax: 983,
        dvs_star: 0.5955,
        Adj: 0,
        DVS: 0.2,
        color: '#ff7f50' // Coral
    },
    {
        id: 'コシヒカリ',
        name: 'コシヒカリ',
        gv: 58.2987,
        th: 17.2392,
        lc: 15.7508,
        a: 0.2438,
        b: 0.8537,
        tmax: 1040,
        dvs_star: 0.5846,
        Adj: 0,
        DVS: 0.2,
        color: '#90ee90' // LightGreen
    },
    {
        id: 'にじのきらめき',
        name: 'にじのきらめき',
        gv: 66.2100,
        th: 18.7870,
        lc: 20.8501,
        a: 0.2542,
        b: 0.6604,
        tmax: 1144,
        dvs_star: 0.5321,
        Adj: 0,
        DVS: 0.2,
        color: '#87cefa' // LightSkyBlue
    },
    {
        id: '笑みたわわ',
        name: '笑みたわわ',
        gv: 80.8932,
        th: 18.4186,
        lc: 20.4161,
        a: 0.5154,
        b: 0.7213,
        tmax: 1355,
        dvs_star: 0.5470,
        Adj: 0,
        DVS: 0.2,
        color: '#ffd700' // Gold
    },
    {
        id: '一番星',
        name: '一番星',
        gv: 49.5995,
        th: 19.5648,
        lc: 21.6840,
        a: 0.2014,
        b: 1.4016,
        tmax: 916,
        dvs_star: 0.5990,
        Adj: 0,
        DVS: 0.2,
        color: '#da70d6' // Orchid
    },
    {
        id: 'ふくまるSL',
        name: 'ふくまるSL',
        gv: 55.0104,
        th: 18.6164,
        lc: 18.3366,
        a: 0.2329,
        b: 0.7391,
        tmax: 990,
        dvs_star: 0.5898,
        Adj: 0,
        DVS: 0.2,
        color: '#20b2aa' // LightSeaGreen
    }
];

// The 6 original base varieties that can serve as reference for new varieties
export const BASE_VARIETY_IDS: string[] = DEFAULT_VARIETIES.map(v => v.id);
