import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('map theme canvas filter', () => {
  it('scopes raster color filters to the raster fallback container', () => {
    const styles = readFileSync(resolve(process.cwd(), 'apps/web/src/styles.css'), 'utf8');
    expect(styles).toContain('.state-map-canvas.map-raster-fallback:not(.map-theme-light) .maplibregl-canvas');
    expect(styles).toContain('.state-map-canvas.map-raster-fallback.map-theme-light .maplibregl-canvas');
    expect(styles).not.toContain('.state-map-canvas .maplibregl-canvas { filter: invert');
  });
});
