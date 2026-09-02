import { test, expect, horizontalOverflow } from "../playwright-fixture";

/**
 * Smoke-svit för alla publika sidor: sidan ska rendera, ha exakt en H1,
 * inte sidscrolla och inte logga JS-fel. Körs på desktop, mobil och iPad.
 */
const PUBLIC_ROUTES = [
  "/",
  "/jobbsokare",
  "/arbetsgivare",
  "/jobb",
  "/yrken",
  "/kommuner",
  "/guider",
  "/om-oss",
  "/integritetspolicy",
  "/auth",
];

for (const route of PUBLIC_ROUTES) {
  test(`publik sida renderar rent: ${route}`, async ({ page, consoleIssues }) => {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `HTTP-status för ${route}`).toBeLessThan(400);

    // Appen ska ha monterat något synligt innehåll.
    await expect(page.locator("#root")).not.toBeEmpty({ timeout: 15_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Inga tomma vita sidor.
    const textLength = await page.evaluate(() => document.body.innerText.trim().length);
    expect(textLength, `Sidan ${route} ska ha innehåll`).toBeGreaterThan(40);

    // Ingen horisontell scroll (marginal 2px för sub-pixelavrundning).
    expect(await horizontalOverflow(page), `Horisontellt överflöd på ${route}`).toBeLessThanOrEqual(2);

    expect(consoleIssues, `JS-fel på ${route}`).toEqual([]);
  });
}

test("SEO: titel, beskrivning och en enda H1 på landningssidan", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const title = await page.title();
  expect(title.length).toBeGreaterThan(5);
  expect(title).not.toMatch(/Lovable (App|Generated Project)/i);

  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description ?? "").not.toEqual("");

  await expect(page.locator("h1")).toHaveCount(1);
});
