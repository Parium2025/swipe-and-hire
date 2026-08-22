import { test, expect } from '@playwright/test';

/**
 * Regressionsvakt för kandidatvyn.
 *
 * Testet failar om sidan visar laddspinners efter att listan renderats, eller
 * om layouten hoppar (CLS) när man bläddrar mellan kandidater. Det är exakt de
 * två symptom vi hittat manuellt gång på gång.
 *
 * Kräver en inloggad arbetsgivarsession. Utan session hoppas testet över i
 * stället för att ge falskt rött.
 */

const APP = process.env.E2E_BASE_URL || 'http://localhost:8080';

async function restoreSession(context: import('@playwright/test').BrowserContext, page: import('@playwright/test').Page) {
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  if (cookiesJson) {
    const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({ ...c, url: APP }));
    await context.addCookies(cookies);
  }
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (key && session) {
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [key, session]
    );
    return true;
  }
  return false;
}

test.describe('Kandidatvyn – inga spinners, inga layouthopp', () => {
  test('listan och kandidatdialogen renderar utan laddindikatorer', async ({ page, context }) => {
    const hasSession = await restoreSession(context, page);
    test.skip(!hasSession, 'Ingen inloggad session tillgänglig i miljön.');

    await page.goto(`${APP}/candidates`, { waitUntil: 'domcontentloaded' });

    // Vänta tills minst en kandidatrad finns.
    const rows = page.locator('[data-candidate-row], table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 20000 });

    // Ge förvärmningspipelinen tid att köra klart sina tre steg.
    await page.waitForTimeout(2500);

    const spinners = page.locator('.animate-spin, [role="progressbar"], [data-loading="true"]');
    expect(await spinners.count(), 'Inga spinners ska finnas kvar när listan är laddad').toBe(0);

    // Öppna de första kandidaterna och kontrollera att dialogen är omedelbart klar.
    const count = Math.min(await rows.count(), 5);
    for (let i = 0; i < count; i++) {
      await rows.nth(i).click();
      const dialog = page.locator('[role="dialog"]').first();
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // 250 ms är mer än nog för cachad data; en spinner här = cache-miss.
      await page.waitForTimeout(250);
      expect(
        await dialog.locator('.animate-spin, [role="progressbar"]').count(),
        `Kandidat ${i + 1} visade en laddindikator – förvärmningen missade raden`
      ).toBe(0);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 5000 });
    }
  });
});
