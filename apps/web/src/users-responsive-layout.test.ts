import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('responsive user management layout', () => {
  it('stacks the form and user list before tablet content becomes cramped', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*1180px\)\s*\{[^}]*\.users-layout\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  });

  it('stacks fields and actions on narrow mobile screens', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-form-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-actions\s*\{[^}]*flex-wrap:\s*wrap;/s);
  });

  it('contains long user identity text inside its grid column', () => {
    expect(styles).toMatch(/\.user-cell-name\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*232px;[^}]*min-width:\s*0;/s);
    expect(styles).toMatch(/\.user-avatar\s*\{[^}]*flex-shrink:\s*0;/s);
    expect(styles).toMatch(/\.user-cell-role\s*\{[^}]*min-width:\s*0;[^}]*overflow:\s*hidden;/s);
    expect(appSource).toContain('className="user-name-text" title={user.display_name}');
  });
});
