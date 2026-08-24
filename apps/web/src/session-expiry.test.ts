import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('expired session exit layer', () => {
  it('returns to login after any pointer interaction or an accessible keyboard action', () => {
    expect(appSource).toContain('function exitExpiredSession()');
    expect(appSource).toContain("sessionStorage.removeItem('healthlink.session')");
    expect(appSource).toMatch(/sessionExpired\s*&&\s*\(\s*<div[^>]+className="session-expired-exit-layer"[^>]+onPointerDown=\{exitExpiredSession\}/s);
    expect(appSource).toContain("window.addEventListener('keydown', exitOnKeyboard)");
    expect(appSource).toContain("if (['Enter', ' ', 'Escape'].includes(event.key)) exitExpiredSession();");
    expect(styles).toMatch(/\.session-expired-exit-layer\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;[^}]*z-index:\s*100000;/s);
  });
});
