import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('user edit modal layout', () => {
  it('expands with the form instead of creating an internal modal scrollbar', () => {
    expect(styles).toMatch(/\.user-edit-modal\s*\{[^}]*height:\s*auto;[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  });
});
