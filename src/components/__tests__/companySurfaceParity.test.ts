import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('company background and deliberate selection', () => {
  const dialog = readFileSync('src/components/CompanyProfileDialog.tsx', 'utf8');
  const employer = readFileSync('src/components/CompanyReviews.tsx', 'utf8');
  const search = readFileSync('src/pages/SearchJobs.tsx', 'utf8');
  const css = readFileSync('src/index.css', 'utf8');

  it('uses the same frosted surface in both roles and every dialog state', () => {
    expect(dialog.match(/company-profile-surface/g)).toHaveLength(3);
    expect(dialog.match(/overlayClassName="company-profile-backdrop"/g)).toHaveLength(3);
    expect(dialog).not.toContain('bg-card-parium');
    expect(employer).toContain('company-profile-surface border rounded-lg p-6');
    expect(css).toContain('.company-profile-backdrop {');
    expect(css).toContain('.company-profile-backdrop { background: var(--gradient-app-shell); }');
    expect(css).toContain('.company-profile-backdrop::before {');
    expect(css).toContain('.company-profile-backdrop::after {');
  });

  it('distinguishes applied company filters from cmdk automatic active result', () => {
    expect(search).toContain('data-company-selected={selectedCompanies.includes(name)}');
    expect(css).toContain('.company-result-option[data-company-selected="false"]');
    expect(css).toMatch(/@media \(hover: none\), \(pointer: coarse\) \{\s*\.company-result-option/);
    expect(search).toContain('if (isTouchOnlyInput) event.preventDefault();');
  });
});