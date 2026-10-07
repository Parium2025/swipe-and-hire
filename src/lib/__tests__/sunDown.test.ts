import { isSunDownAt } from '../weatherApi';
import { it, expect } from 'vitest';
it('sun', () => {
  expect(isSunDownAt(65.65, 11.95, new Date('2026-10-07T03:38:00Z'))).toBe(true);
  expect(isSunDownAt(65.65, 11.95, new Date('2026-10-07T11:00:00Z'))).toBe(false);
  expect(isSunDownAt(59.33, 18.07, new Date('2026-10-07T05:30:00Z'))).toBe(false); // Sthlm efter soluppgång ~07:15 lokal
  expect(isSunDownAt(59.33, 18.07, new Date('2026-10-07T04:30:00Z'))).toBe(true);
});
