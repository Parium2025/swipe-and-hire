import { test, expect } from "../playwright-fixture";

// Dev-servern kompilerar rutter lat, så guard-testerna får extra tid.
test.describe.configure({ timeout: 90_000 });

/**
 * Skyddade vyer får aldrig visa data för utloggade besökare. Testet är
 * medvetet tolerant kring exakt destination (inloggningsvy eller landning)
 * men strikt kring att skyddat innehåll inte läcker.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/my-jobs",
  "/candidates",
  "/my-candidates",
  "/messages",
  "/settings",
  "/billing",
  "/subscription",
  "/profile",
  "/saved-jobs",
  "/my-applications",
];

for (const route of PROTECTED_ROUTES) {
  test(`utloggad besökare får inte se ${route}`, async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(route, { waitUntil: "domcontentloaded" });

    // Vänta tills auth-tillståndet är avgjort: antingen omdirigering, en
    // inloggningsyta eller att laddvyn försvinner.
    const settled = await page
      .waitForFunction(
        (target) => {
          if (window.location.pathname !== target) return true;
          const text = (document.body.innerText || "").toLowerCase();
          if (/laddar/.test(text) && text.length < 200) return false;
          return text.length > 0;
        },
        route,
        { timeout: 45_000 },
      )
      .then(() => true)
      .catch(() => false);
    expect(settled, `${route} fastnade i laddläge för utloggad besökare`).toBe(true);

    const url = new URL(page.url());
    const onProtectedRoute = url.pathname === route;

    if (onProtectedRoute) {
      // Kvar på routen är bara okej om en inloggningsyta visas i stället för data.
      const body = (await page.locator("body").innerText()).toLowerCase();
      const showsAuthSurface = /logga in|skapa konto|registrera|välkommen/.test(body);
      expect(showsAuthSurface, `${route} visade skyddat innehåll för utloggad besökare`).toBe(true);
    }

  });
}
