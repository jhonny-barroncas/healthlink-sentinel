import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('state map unit cards', () => {
  it('provides an accessible expand control for each unit card', () => {
    expect(source).toContain('aria-expanded={isExpanded}');
    expect(source).toContain('expandedUnitIds');
    expect(source).toContain('state-unit-link-summary');
    expect(source).toContain('setExpandedUnitIds(new Set())');
    expect(styles).toContain('.state-unit-assets.expanded .state-unit-expand-arrow');
    expect(styles).toContain('.state-unit-expand-arrow');
    expect(styles).toContain('.state-unit-expand-toggle');
  });

  it('keeps equipment creation contextual to the unit card instead of the panel header', () => {
    expect(source).toContain('onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); openUnitContext(unit');
    expect(source).toContain('<PlusIcon /> Adicionar equipamento</button></div></div>');
    expect(source).not.toContain('state-add-unit-button');
  });

  it('closes the unit quick menu when that unit card is collapsed or the map selection closes', () => {
    expect(source).toContain("if (next.has(unitId)) { next.delete(unitId); if (unitContext?.unit.unit_id === unitId) setUnitContext(null); }");
    expect(source).toContain("onClose={() => { setSelectedUnit(null); setSelectedLink(null); setUnitContext(null); setExpandedUnitIds(new Set()); }}");
  });

  it('exposes permanent unit deletion in the detail header and card context menu', () => {
    expect(source).toContain("menuAction('delete')");
    expect(source).toContain('Excluir unidade');
    expect(source).toContain('function confirmDeleteUnit');
    expect(source).toContain("api(`/v1/units/${deleteTarget.unit_id}`, token, { method: 'DELETE' })");
  });
});
