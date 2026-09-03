/**
 * Global uppvärmning innan E2E-sviten.
 *
 * Vite kompilerar rutter lazily. Första besöket på en tung sida kan därför ta
 * flera sekunder extra, vilket gjorde enstaka tester flaky under parallell
 * last. Här besöks alla rutter en gång i förväg så att kompileringen är klar
 * när de riktiga testerna startar. Detta rör aldrig appens kod eller data.
 */
import { chromium } from "@playwright/test";

const ROUTES = [
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
  "/dashboard",
];

export default async function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:8080";
  const browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const page = await browser.newPage();

  for (const route of ROUTES) {
    try {
      await page.goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 60_000 });
    } catch {
      // Uppvärmning är best-effort; testerna avgör själva om något är trasigt.
    }
  }

  await browser.close();
}
