import { describe, expect, it } from 'vitest';
import { canOnlySeeMobileUnits } from './authorization.js';

describe('unit visibility authorization', () => {
  it('restricts the mobile supervisor to mobile units', () => {
    expect(canOnlySeeMobileUnits(['mobile_unit_supervisor'])).toBe(true);
    expect(canOnlySeeMobileUnits(['tenant_administrator'])).toBe(false);
    expect(canOnlySeeMobileUnits(['mobile_unit_supervisor', 'tenant_administrator'])).toBe(false);
  });
});
