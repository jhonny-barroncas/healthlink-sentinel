import { describe, expect, it } from 'vitest';
import { mapRasterFallbackStyle, mapRasterLightFallbackStyle } from './map-styles.js';

describe('map raster fallback styles', () => {
  it('uses public OpenStreetMap tiles without a CARTO API key', () => {
    const styles = [mapRasterFallbackStyle, mapRasterLightFallbackStyle];
    const tileUrls = styles.flatMap((style) => Object.values(style.sources).flatMap((source) => source.tiles ?? []));

    expect(tileUrls).toHaveLength(2);
    expect(tileUrls.every((url) => url.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
    expect(tileUrls.some((url) => url.includes('cartocdn.com'))).toBe(false);
  });
});
