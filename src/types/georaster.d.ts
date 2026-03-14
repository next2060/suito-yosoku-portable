declare module 'georaster' {
    const parseGeoraster: (buffer: ArrayBuffer | Uint8Array | String) => Promise<any>;
    export default parseGeoraster;
}

declare module 'georaster-layer-for-leaflet' {
    import * as L from 'leaflet';
    export default class GeoRasterLayer extends L.Layer {
        constructor(options: any);
    }
}
