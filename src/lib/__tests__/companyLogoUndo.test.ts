import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = readFileSync(resolve(process.cwd(), 'src/pages/employer/CompanyProfile.tsx'), 'utf8');
const section = readFileSync(resolve(process.cwd(), 'src/pages/employer/companyProfile/CompanyLogoSection.tsx'), 'utf8');

describe('företagsloggan — ångra i stället för fråga', () => {
  it('tar bort direkt med synkron spärr och kan återställas', () => {
    expect(page).not.toContain('<DeleteLogoDialog');
    expect(page).toContain('if (!current) return;');
    expect(page).toContain('if (!deleted || logoUrlRef.current) return;');
    expect(section).toContain('aria-label="Återställ företagslogga"');
  });
  it('visar inga lyckade notiser för loggan', () => {
    expect(page).not.toContain('Logga borttagen');
    expect(page).not.toContain('Logga uppladdad!');
  });
});
