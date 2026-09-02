import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const iconSource = readFileSync(new URL('./icons.tsx', import.meta.url), 'utf8');

describe('collapsible desktop sidebar', () => {
  it('stays compact and expands as an overlay on hover or keyboard focus', () => {
    expect(styles).toMatch(/\.app-shell\s*\{[^}]*grid-template-columns:\s*76px 1fr;/s);
    expect(styles).toMatch(/\.sidebar\s*\{[^}]*z-index:\s*200;[^}]*width:\s*76px;[^}]*transition:\s*width/s);
    expect(styles).toMatch(/\.sidebar:is\(:hover,\s*:focus-within\)\s*\{[^}]*width:\s*250px;/s);
    expect(styles).not.toMatch(/\.sidebar:(?:is|not)\([^}]*:has\(/);
    expect(appSource).toContain("onPointerUp={(event) => { const button = (event.target as HTMLElement).closest('button'); button?.blur(); }}");
  });

  it('uses dedicated labels that can be hidden while compact', () => {
    expect(appSource).toContain('className="nav-label">Visão geral</span>');
    expect(styles).toMatch(/\.sidebar:not\(:hover\):not\(:focus-within\)\s+\.nav-label,[^{]+\{[^}]*opacity:\s*0;/s);
    expect(styles).toMatch(/\.sidebar:not\(:hover\):not\(:focus-within\)\s+\.brand\s*>\s*div,[^{]+\{[^}]*width:\s*0;[^}]*overflow:\s*hidden;/s);
  });

  it('keeps the cyan glider visible on active primary and secondary navigation', () => {
    expect(styles).toMatch(/\.nav-item::before\s*\{[^}]*background:\s*var\(--cyan\);[^}]*box-shadow:[^}]*rgba\(53,\s*211,\s*208,[^)]+\);[^}]*opacity:\s*0;/s);
    expect(styles).toMatch(/\.nav-item\.active::before\s*\{[^}]*opacity:\s*1;/s);
    expect(styles).toMatch(/\.nav-item\.active\s*\{[^}]*background:\s*linear-gradient\(90deg,\s*rgba\(53,\s*211,\s*208,[^)]+\),\s*transparent\);/s);
    expect(styles).toMatch(/\.nav-subitem\.active::before\s*\{[^}]*background:\s*var\(--cyan\);[^}]*box-shadow:[^}]*rgba\(53,\s*211,\s*208,[^)]+\);/s);
  });

  it('keeps every shared navigation icon exported and imported', () => {
    expect(iconSource).toContain('export function NavDashboardIcon()');
    expect(appSource).toMatch(/import \{[^}]*NavDashboardIcon[^}]*\} from '\.\/icons\.js';/s);
    const referenced = [...appSource.matchAll(/<([A-Z][A-Za-z]+Icon)\b/g)].map((match) => match[1]);
    const locallyDefined = new Set([...appSource.matchAll(/function ([A-Z][A-Za-z]+Icon)\b/g)].map((match) => match[1]));
    const exported = new Set([...iconSource.matchAll(/export function ([A-Z][A-Za-z]+Icon)\b/g)].map((match) => match[1]));
    expect([...new Set(referenced)].filter((name) => !locallyDefined.has(name) && !exported.has(name))).toEqual([]);
  });
});
