import { test, expect } from "../playwright-fixture";

/**
 * Regressionsvakt för Snapchat/in-app-browser-buggen: när webbläsarens
 * verktygsfält fälls in ändras visualViewport-höjden. Hjälten får INTE
 * skala om av det. Vi simulerar genom att scrolla och jämföra geometrin.
 */
test.describe("Landningssidans hjälte är storleksstabil", () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true, isMobile: true });

  for (const route of ["/", "/jobbsokare", "/arbetsgivare"]) {
    test(`ingen omskalning vid scroll: ${route}`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);

      const hero = page.locator("h1").first();
      await expect(hero).toBeVisible({ timeout: 15_000 });

      const measure = async () =>
        page.evaluate(() => {
          const h1 = document.querySelector("h1");
          const img = document.querySelector("img, video");
          return {
            h1: h1 ? Math.round(h1.getBoundingClientRect().width) : 0,
            h1Font: h1 ? getComputedStyle(h1).fontSize : "",
            media: img ? Math.round((img as HTMLElement).getBoundingClientRect().width) : 0,
          };
        });

      const before = await measure();

      // Simulera toolbar-kollaps: scrolla ner, tillbaka upp, dispatcha resize.
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await page.waitForTimeout(400);
      await page.mouse.wheel(0, -400);
      await page.waitForTimeout(600);

      const after = await measure();

      expect(after.h1Font, "H1-typografin ska inte ändras av scroll").toBe(before.h1Font);
      expect(Math.abs(after.h1 - before.h1), "H1-bredden ska vara stabil").toBeLessThanOrEqual(2);
      if (before.media > 0) {
        expect(Math.abs(after.media - before.media), "Hjältemedia ska inte skala om").toBeLessThanOrEqual(4);
      }
    });
  }
});
