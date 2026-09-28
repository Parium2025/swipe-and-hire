import { describe, expect, it } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

describe('Avatar – aldrig tom cirkel', () => {
  it('visar initialerna när bilden inte går att ladda', async () => {
    const { container, findByText } = render(
      <Avatar>
        <AvatarImage src="https://example.invalid/x.webp" />
        <AvatarFallback>HM</AvatarFallback>
      </Avatar>,
    );
    const img = container.querySelector('img')!;
    act(() => { fireEvent.error(img); });
    expect(await findByText('HM')).toBeTruthy();
  });

  it('kontextvärdet är stabilt så att bildens effekter inte loopar', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/components/ui/avatar.tsx'), 'utf8');
    expect(src).toContain('React.useMemo(() => ({ imageLoaded, setImageLoaded }), [imageLoaded])');
  });
});

describe('Arbetsgivarprofil – utkast skriver aldrig över profilbilden', () => {
  it('utkastet återställer bara namn; bilden kommer från servern', () => {
    const src = readFileSync(resolve(process.cwd(), 'src/pages/employer/EmployerProfile.tsx'), 'utf8');
    expect(src).toContain('const profile_image_url = values.profile_image_url;');
    expect(src).not.toContain('profile_image_url: savedDraft.profile_image_url');
  });
});
