import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

export type ConsoleIssue = { type: string; text: string };

/**
 * Delad fixture:
 *  - `consoleIssues` samlar console.error/pageerror så varje test kan hävda
 *    att sidan är ren utan att duplicera lyssnarkod.
 *  - `session` återställer en inloggad Lovable-session när miljön har en.
 *
 * Kända, ofarliga brus-meddelanden filtreras bort så suiten inte ger falskt rött.
 */
const IGNORED_CONSOLE_PATTERNS: RegExp[] = [
  /ResizeObserver loop/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  /favicon/i,
  /net::ERR_ABORTED/i,
  // Dev-serverbrus: Vite HMR-socket och avbrutna resursanrop i sandlådan.
  /WebSocket connection to/i,
  /net::ERR_CONNECTION_REFUSED/i,
  /Failed to load resource/i,
];

export const test = base.extend<{ consoleIssues: ConsoleIssue[] }>({
  consoleIssues: async ({ page }, use) => {
    const issues: ConsoleIssue[] = [];
    page.on("console", (msg) => {
      if (msg.type() !== "error") return;
      const text = msg.text();
      if (IGNORED_CONSOLE_PATTERNS.some((r) => r.test(text))) return;
      issues.push({ type: "console.error", text });
    });
    page.on("pageerror", (err) => {
      const text = err.message;
      if (IGNORED_CONSOLE_PATTERNS.some((r) => r.test(text))) return;
      issues.push({ type: "pageerror", text });
    });
    await use(issues);
  },
});

export { expect };

/** Returnerar true om en riktig inloggad session kunde återställas. */
export async function restoreSession(context: BrowserContext, page: Page): Promise<boolean> {
  const baseURL = process.env.E2E_BASE_URL || "http://localhost:8080";
  const cookiesJson = process.env.LOVABLE_BROWSER_SUPABASE_COOKIES_JSON;
  if (cookiesJson) {
    try {
      const cookies = JSON.parse(cookiesJson).map((c: Record<string, unknown>) => ({ ...c, url: baseURL }));
      await context.addCookies(cookies);
    } catch {
      /* ignorera trasig cookie-payload */
    }
  }
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  if (!key || !session) return false;
  await page.evaluate(
    ([k, v]) => window.localStorage.setItem(k as string, v as string),
    [key, session],
  );
  return true;
}

/** Mäter horisontellt överflöd – appen ska aldrig sidscrolla. */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}
