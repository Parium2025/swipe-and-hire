import { defineConfig, devices } from "@playwright/test";

/**
 * E2E-konfiguration för Parium.
 *
 * Testerna körs mot den redan igångsatta dev-servern (port 8080). Inget i
 * appens kod påverkas – suiten är rent observerande och skriver aldrig data
 * utan en explicit inloggad testsession.
 */
const baseURL = process.env.E2E_BASE_URL || "http://localhost:8080";

/**
 * Sandlådan saknar bibliotek för headless-shell-bygget, därför används
 * det fullständiga Chromium-bygget (channel "chromium") i alla projekt.
 */
const launchOptions = { args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] };

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Vite kompilerar rutter lat; under parallell last tar första besöket
  // på en tung sida längre tid än en normal användare upplever.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: 2,
  workers: 2,

  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    launchOptions,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" as const, hasTouch: true, isMobile: true },
    },
    {
      name: "tablet",
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "chromium" as const, hasTouch: true },
    },
  ],
});
