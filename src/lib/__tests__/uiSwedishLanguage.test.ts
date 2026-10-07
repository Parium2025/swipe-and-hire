import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

describe('consistent Swedish UI language', () => {
  for (const name of ['AuthDesktop', 'AuthTablet', 'AuthMobile']) {
    it(`uses correct password and email wording in ${name}`, () => {
      const source = read(`src/components/${name}.tsx`);
      expect(source).toContain('Medelstarkt lösenord');
      expect(source).toContain('Lösenordet måste innehålla minst 7 tecken.');
      expect(source).toContain('Ange företagets officiella e-postadress.');
      expect(source).not.toContain('Denna mail');
    });
  }

  for (const name of ['AppSidebar', 'JobSeekerTopNav', 'EmployerSidebar', 'EmployerTopNav']) {
    it(`uses Swedish sentence case in ${name}`, () => {
      const source = read(`src/components/${name}.tsx`);
      for (const incorrect of ['Sök Jobb', 'Sparade Jobb', 'Mina Ansökningar', 'Min Profil', 'Mina Annonser', 'Alla Kandidater', 'Mina Kandidater']) {
        expect(source).not.toContain(incorrect);
      }
      expect(source).toContain('Min profil');
    });
  }

  it('keeps loading and loaded saved-job helper copy identical', () => {
    const source = read('src/pages/SavedJobs.tsx');
    for (const text of ['Dina favoritjobb samlade på ett ställe.', 'Jobb du har svept förbi — återställ dem du ångrar.']) {
      expect(source.split(text)).toHaveLength(3);
    }
  });

  it('uses matching interview-response wording in welcome and settings', () => {
    const text = 'Alternativet "I appen" innebär att svaret också visas som ett meddelande från kandidaten i chatten.';
    expect(read('src/components/EmployerWelcomeTunnel.tsx')).toContain(text);
    expect(read('src/components/employer/settings/EmployerNotificationsPanel.tsx')).toContain(text);
  });

  it('keeps onboarding profile targeting independent of translated labels', () => {
    expect(read('src/components/AppSidebar.tsx')).toContain("data-onboarding={item.url === '/profile' ? 'min-profil' : undefined}");
  });

  it('uses precise notification wording for both audiences', () => {
    for (const file of ['src/components/JobSeekerNotificationSettings.tsx', 'src/components/employer/settings/EmployerNotificationsPanel.tsx']) {
      expect(read(file)).toContain('skickas till din e-postadress.');
    }
    expect(read('src/components/JobSeekerNotificationSettings.tsx')).toContain('reglagen styr bara hur du aviseras om dem.');
  });

  it('spells profile media controls consistently', () => {
    const source = read('src/pages/Profile.tsx');
    for (const text of ['Anpassa coverbild', 'Ta bort coverbild', 'Lägg till coverbild', 'Laddar upp coverbild…']) {
      expect(source).toContain(text);
    }
    expect(source).not.toContain('cover-bilden för redigering.');
  });

  it('keeps media wording consistent across profile and onboarding', () => {
    for (const file of ['src/pages/Profile.tsx', 'src/components/WelcomeTunnel.tsx', 'src/components/candidateProfiles/CandidateProfileEditor.tsx']) {
      expect(read(file)).toContain('Lägg till coverbild');
      expect(read(file)).toContain('Ta bort coverbild');
    }
  });

  it('uses the same complete availability question across profile views', () => {
    for (const file of ['src/pages/Profile.tsx', 'src/pages/ProfilePreview.tsx', 'src/components/WelcomeTunnel.tsx', 'src/components/candidateProfile/ProfileInfoSections.tsx']) {
      expect(read(file)).toContain('När kan du börja ett nytt jobb?');
      expect(read(file)).not.toContain('När kan du börja nytt jobb?');
    }
  });
});