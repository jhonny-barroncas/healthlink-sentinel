import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('responsive user management layout', () => {
  it('stacks the form and user list before tablet content becomes cramped', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*1180px\)\s*\{[^}]*\.users-layout\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  });

  it('stacks fields and actions on narrow mobile screens', () => {
    expect(styles).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-form-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s);
    expect(styles).toMatch(/@media\s*\(max-width:\s*640px\)[\s\S]*?\.user-actions\s*\{[^}]*flex-wrap:\s*wrap;/s);
  });
});
