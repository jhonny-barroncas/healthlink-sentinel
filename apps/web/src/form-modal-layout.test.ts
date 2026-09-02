import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modalStyles = readFileSync(new URL('./form-modal.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('form modal layout', () => {
  it('keeps every CSS block closed so the production minifier can parse the modal stylesheet', () => {
    expect(modalStyles.match(/\{/g)?.length ?? 0).toBe(modalStyles.match(/\}/g)?.length ?? 0);
  });

  it('keeps the desktop equipment card fully visible without vertical scrolling', () => {
    expect(modalStyles).toContain('.form-card[aria-label^="Novo equipamento"]');
    expect(modalStyles).toMatch(/\.form-card\[aria-label\^="Novo equipamento"\]\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible;/s);
  });

  it('shows unit registration API errors inside the modal opened from the map', () => {
    expect(appSource).toContain('const [formError, setFormError] = useState(\'\');');
    expect(appSource).toContain('<div className="form-error" role="alert">{formError}</div>');
    expect(appSource).toContain('setFormError(reason instanceof Error ? reason.message : \'Falha ao cadastrar unidade.\')');
  });
});
