import { expect, test } from '@playwright/test';

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} krävs för ett autentiserat offline-Home-test; testet får inte hoppas över.`);
  }
  return value;
};

const AUTH_STORAGE_KEY = requiredEnv('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY');
const AUTH_STORAGE_VALUE = requiredEnv('LOVABLE_BROWSER_SUPABASE_SESSION_JSON');

if (!/^sb-[a-z0-9]+-auth-token$/.test(AUTH_STORAGE_KEY)) {
  throw new Error('LOVABLE_BROWSER_SUPABASE_STORAGE_KEY har oväntat format.');
}

const parsedSession = JSON.parse(AUTH_STORAGE_VALUE) as {
  user?: { id?: string };
  currentSession?: { user?: { id?: string }; expires_at?: number };
  expires_at?: number;
};
const session = parsedSession.currentSession ?? parsedSession;
const userId = session.user?.id;
if (!userId) throw new Error('Testsessionen saknar user.id.');
if (typeof session.expires_at === 'number' && session.expires_at < Date.now() / 1000 + 300) {
  throw new Error('Testsessionen löper ut inom fem minuter och kan inte ge stabil evidens.');
}

test('an authenticated jobseeker can cold-start the real Home offline in a new tab', async ({
  context,
  page,
}) => {
  // Use a harmless same-origin document to seed the first tab before React and
  // Supabase bootstrap. The new offline tab below receives no sessionStorage.
  await page.goto('/manifest.json');
  await page.evaluate(
    ({ authKey, authValue, ownerId }) => {
      const now = String(Date.now());
      localStorage.setItem('parium-remember-me', 'true');
      localStorage.setItem(`parium-auth-snapshot:${authKey}`, authValue);
      localStorage.setItem('parium-auth-snapshot-owner', ownerId);
      localStorage.setItem('parium-last-activity', now);
      sessionStorage.setItem('parium-remember-me', 'true');
      sessionStorage.setItem('parium-last-activity', now);
      sessionStorage.setItem('parium_cache_owner', ownerId);
      sessionStorage.setItem(authKey, authValue);
    },
    { authKey: AUTH_STORAGE_KEY, authValue: AUTH_STORAGE_VALUE, ownerId: userId },
  );

  await page.goto('/home', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body[data-jobseeker-home-active="true"]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Din översikt' })).toBeVisible();
  await expect.poll(
    () => page.evaluate(() => navigator.serviceWorker.ready.then(() => true)),
  ).toBe(true);

  // First install does not control the already-open document. Reload once and
  // require the real authenticated Home again under worker control.
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: 'domcontentloaded' });
  }
  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
  ).toBe(true);
  await expect(page.locator('body[data-jobseeker-home-active="true"]')).toBeVisible();

  const cachedProfile = await page.evaluate(() => {
    const raw = localStorage.getItem('parium_cached_profile');
    return raw ? JSON.parse(raw) : null;
  });
  expect(cachedProfile).toMatchObject({
    user_id: userId,
    role: 'job_seeker',
    onboarding_completed: true,
  });

  const shellCaches = await page.evaluate(() => caches.keys());
  expect(shellCaches.some((name) => name.startsWith('parium-shell-'))).toBe(true);
  expect(shellCaches).not.toContain('parium-api-v1');
  expect(shellCaches).not.toContain('parium-images-v1');

  await page.close();
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  await offlinePage.goto('/home?offline-shell-e2e=1', { waitUntil: 'domcontentloaded' });

  expect(new URL(offlinePage.url()).pathname).toBe('/home');
  await expect(offlinePage.locator('body[data-jobseeker-home-active="true"]')).toBeVisible();
  await expect(offlinePage.getByRole('heading', { name: 'Din översikt' })).toBeVisible();
  await expect(offlinePage.getByText(/Offline –/)).toBeVisible({ timeout: 10_000 });
  await expect(offlinePage.getByText(/Något gick fel/i)).toHaveCount(0);

  const cachedRequestUrls = await offlinePage.evaluate(async () => {
    const result: string[] = [];
    for (const cacheName of await caches.keys()) {
      const cache = await caches.open(cacheName);
      result.push(...(await cache.keys()).map((request) => request.url));
    }
    return result;
  });
  expect(cachedRequestUrls.some((url) => /supabase\.co|\/api\/|\/rest\/|\/auth\/|\/storage\//.test(url)))
    .toBe(false);
});
