import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('collapsible desktop sidebar', () => {
  it('stays compact and expands as an overlay on hover or keyboard focus', () => {
    expect(styles).toMatch(/\.app-shell\s*\{[^}]*grid-template-columns:\s*76px 1fr;/s);
    expect(styles).toMatch(/\.sidebar\s*\{[^}]*width:\s*76px;[^}]*transition:\s*width/s);
    expect(styles).toMatch(/\.sidebar:is\(:hover,\s*:focus-within\)\s*\{[^}]*width:\s*250px;/s);
  });

  it('uses dedicated labels that can be hidden while compact', () => {
    expect(appSource).toContain('className="nav-label">Visão geral</span>');
    expect(styles).toMatch(/\.sidebar:not\(:hover\):not\(:focus-within\)\s+\.nav-label,[^{]+\{[^}]*opacity:\s*0;/s);
  });
});
