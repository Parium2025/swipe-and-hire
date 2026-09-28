import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('autosparande sidor visar aldrig "Osparade ändringar"', () => {
  for (const [file, route] of [
    ['src/pages/employer/EmployerProfile.tsx', '/employer-profile'],
    ['src/pages/employer/CompanyProfile.tsx', '/company-profile'],
  ]) {
    it(file, () => {
      const src = read(file);
      expect(src).toContain('registerAutosaveFlush(');
      expect(src).toContain(`flushPathname === '${route}'`);
      expect(src).not.toContain("addEventListener('beforeunload'");
    });
  }
  it('jobbsökarprofilen', () => {
    expect(read('src/pages/Profile.tsx')).toContain('registerAutosaveFlush(');
  });
});
