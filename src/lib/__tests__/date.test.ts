import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatTimeAgo,
  formatCompactTime,
  formatDateShortSv,
  getEffectiveExpiresAt,
  isJobExpiredCheck,
  getTimeRemaining,
} from "@/lib/date";
import { REPUBLISH_DAYS } from "@/lib/jobStatus";

const NOW = new Date("2026-09-02T12:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("formatTimeAgo", () => {
  it("visar 'Just nu' inom första timmen", () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 5 * 60_000))).toBe("Just nu");
  });

  it("visar timmar, dagar, månader och år", () => {
    expect(formatTimeAgo(new Date(NOW.getTime() - 3 * 3_600_000))).toBe("3 timmar sedan");
    expect(formatTimeAgo(new Date(NOW.getTime() - 2 * 86_400_000))).toBe("2 dagar sedan");
  });

  it("hanterar null och ogiltiga datum som '-'", () => {
    expect(formatTimeAgo(null)).toBe("-");
    expect(formatTimeAgo("inte ett datum")).toBe("-");
  });
});

describe("formatCompactTime", () => {
  it("använder kompakta enheter", () => {
    expect(formatCompactTime(new Date(NOW.getTime() - 30 * 60_000))).toBe("nu");
    expect(formatCompactTime(new Date(NOW.getTime() - 5 * 3_600_000))).toBe("5 tim");
  });

  it("returnerar null för tomma värden", () => {
    expect(formatCompactTime(undefined)).toBeNull();
  });
});

describe("formatDateShortSv", () => {
  it("formaterar på svenska", () => {
    expect(formatDateShortSv("2026-10-19T12:00:00Z")).toBe("19 okt. 2026");
  });

  it("returnerar '-' för ogiltiga datum", () => {
    expect(formatDateShortSv("xyz")).toBe("-");
  });
});

describe("utgångsdatum", () => {
  it("använder expires_at när den är giltig", () => {
    const expires = getEffectiveExpiresAt("2026-01-01T00:00:00Z", "2026-03-01T00:00:00Z");
    expect(expires.toISOString()).toBe(new Date("2026-03-01T00:00:00Z").toISOString());
  });

  it("faller tillbaka på created_at + REPUBLISH_DAYS utan giltig expires_at", () => {
    const created = "2026-01-01T00:00:00Z";
    const expected = new Date(new Date(created).getTime() + REPUBLISH_DAYS * 86_400_000);
    expect(getEffectiveExpiresAt(created, null).toISOString()).toBe(expected.toISOString());
    expect(getEffectiveExpiresAt(created, "trasigt datum").toISOString()).toBe(expected.toISOString());
  });

  it("identifierar utgångna och aktiva annonser", () => {
    expect(isJobExpiredCheck("2026-08-01T00:00:00Z", "2026-08-20T00:00:00Z")).toBe(true);
    expect(isJobExpiredCheck("2026-08-01T00:00:00Z", "2026-12-01T00:00:00Z")).toBe(false);
  });
});

describe("getTimeRemaining", () => {
  it("markerar utgångna annonser", () => {
    const result = getTimeRemaining("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z");
    expect(result).toEqual({ text: "Utgången", isExpired: true });
  });

  it("visar dagar när flera dagar återstår", () => {
    const expires = new Date(NOW.getTime() + 5 * 86_400_000).toISOString();
    const result = getTimeRemaining("2026-01-01T00:00:00Z", expires);
    expect(result.isExpired).toBe(false);
    expect(result.text).toBe("5 dagar");
  });

  it("visar timmar och minuter under ett dygn", () => {
    const expires = new Date(NOW.getTime() + (5 * 60 + 30) * 60_000).toISOString();
    const result = getTimeRemaining("2026-01-01T00:00:00Z", expires);
    expect(result.isExpired).toBe(false);
    expect(result.text).toBe("5h 30min");
  });

  it("visar minuter under sista timmen", () => {
    const expires = new Date(NOW.getTime() + 45 * 60_000).toISOString();
    const result = getTimeRemaining("2026-01-01T00:00:00Z", expires);
    expect(result.text).toBe("45 min");
  });
});
