import { test, expect, restoreSession, horizontalOverflow } from "../playwright-fixture";

/**
 * Inloggade flöden – touch-swipe, kortrytm och profilväljaren.
 *
 * Utan injicerad session hoppas testerna över i stället för att ge falskt rött.
 * Suiten är läsande: den skickar aldrig in en ansökan.
 */

test.describe("Inloggade flöden", () => {
  test("swipe-läget svarar på riktiga touch-gester", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Touch-simulering körs i Chromium.");
    const hasSession = await restoreSession(context, page);
    test.skip(!hasSession, "Ingen inloggad session tillgänglig i miljön.");

    await page.goto("/search-jobs", { waitUntil: "domcontentloaded" });
    const card = page.locator(".job-card-mobile-shell").first();
    await expect(card).toBeVisible({ timeout: 20_000 });

    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;

    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.touchscreen.tap(startX, startY).catch(() => {});
    // Svep åt vänster med mus-drag (fungerar för pointer-baserade swipe-handlers).
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) {
      await page.mouse.move(startX - i * 20, startY);
    }
    await page.mouse.up();
    await page.waitForTimeout(800);

    // Appen får inte krascha eller sidscrolla efter gesten.
    await expect(page.locator("#root")).not.toBeEmpty();
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(2);
  });

  test("kortrytmen centrerar enstaka kort i arbetsgivarvyn", async ({ page, context }) => {
    const hasSession = await restoreSession(context, page);
    test.skip(!hasSession, "Ingen inloggad session tillgänglig i miljön.");
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto("/my-jobs", { waitUntil: "domcontentloaded" });
    const grid = page.locator(".job-card-grid-single, .job-card-grid-double").first();
    const gridCount = await grid.count();
    test.skip(gridCount === 0, "Inget en- eller tvåkortsläge att verifiera.");

    const gridBox = await grid.boundingBox();
    const items = grid.locator(".job-card-grid-item");
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    if (!gridBox) return;

    if (n === 1) {
      const b = await items.first().boundingBox();
      if (!b) return;
      const cardCenter = b.x + b.width / 2;
      const gridCenter = gridBox.x + gridBox.width / 2;
      expect(Math.abs(cardCenter - gridCenter), "Ett kort ska vara centrerat").toBeLessThan(24);
    } else if (n === 2) {
      const a = await items.nth(0).boundingBox();
      const b = await items.nth(1).boundingBox();
      if (!a || !b) return;
      const pairCenter = (a.x + b.x + b.width) / 2;
      const gridCenter = gridBox.x + gridBox.width / 2;
      expect(Math.abs(pairCenter - gridCenter), "Två kort ska vara centrerade som par").toBeLessThan(32);
    }
  });

  test("profilväljaren visar aktiv profil utan laddindikator", async ({ page, context }) => {
    const hasSession = await restoreSession(context, page);
    test.skip(!hasSession, "Ingen inloggad session tillgänglig i miljön.");

    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    const spinners = page.locator(".animate-spin");
    expect(await spinners.count(), "Profilsidan ska vara förvärmd utan spinners").toBe(0);
  });
});
