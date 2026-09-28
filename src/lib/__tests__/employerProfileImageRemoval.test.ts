import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(
  resolve(process.cwd(), 'src/pages/employer/EmployerProfile.tsx'),
  'utf8',
);

describe('arbetsgivarens profilbild', () => {
  it('blockerar dubbla borttagningstryck och skyddar lokala ändringar från profilrefresh', () => {
    expect(source).toContain('if (!currentImage) return;');
    expect(source).toContain('profileImagePathRef.current = \'\';');
    expect(source).toContain('hasUnsavedChanges || localChangesRef.current');
  });

  it('sparar det senaste formulärläget i stället för ett gammalt mellanläge', () => {
    expect(source).toContain('const valuesToSave = { ...formDataRef.current };');
    expect(source).toContain('updateProfile(valuesToSave as any)');
  });
});