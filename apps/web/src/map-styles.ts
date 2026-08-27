type RasterSource = { type: 'raster'; tiles: string[]; tileSize: number; attribution: string };
type RasterStyle = { version: 8; sources: Record<string, RasterSource>; layers: Array<{ id: string; type: 'raster'; source: string }> };

const openStreetMapTiles = ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'];
const openStreetMapAttribution = '© OpenStreetMap contributors';

export const mapRasterFallbackStyle: RasterStyle = {
  version: 8,
  sources: { openStreetMapDark: { type: 'raster', tiles: openStreetMapTiles, tileSize: 256, attribution: openStreetMapAttribution } },
  layers: [{ id: 'openstreetmap-dark-tiles', type: 'raster', source: 'openStreetMapDark' }],
};

export const mapRasterLightFallbackStyle: RasterStyle = {
  version: 8,
  sources: { openStreetMapLight: { type: 'raster', tiles: openStreetMapTiles, tileSize: 256, attribution: openStreetMapAttribution } },
  layers: [{ id: 'openstreetmap-light-tiles', type: 'raster', source: 'openStreetMapLight' }],
};
