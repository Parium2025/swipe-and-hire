import { describe, it, expect } from "vitest";
import { normalizeText, smartMatchScore, smartMatches } from "@/lib/seoSearch";

describe("normalizeText", () => {
  it("gör svenska bokstäver jämförbara med ASCII", () => {
    expect(normalizeText("Örebro")).toBe("orebro");
    expect(normalizeText("Gävle")).toBe("gavle");
    expect(normalizeText("SÅNG")).toBe("sang");
  });

  it("hanterar diakriter", () => {
    expect(normalizeText("Café")).toBe("cafe");
  });
});

describe("smartMatchScore", () => {
  it("tom sökning visar allt", () => {
    expect(smartMatchScore("", ["kock"])).toBe(1);
    expect(smartMatchScore("   ", ["kock"])).toBe(1);
  });

  it("träffar exakt", () => {
    expect(smartMatchScore("kock", ["Kock"])).toBeGreaterThan(0);
  });

  it("träffar svenskt mot ASCII-sökning", () => {
    expect(smartMatchScore("orebro", ["Örebro"])).toBeGreaterThan(0);
  });

  it("AND-logik: alla ord måste träffa", () => {
    expect(smartMatchScore("kock stockholm", ["Kock", "Stockholm"])).toBeGreaterThan(0);
    expect(smartMatchScore("kock umea", ["Kock", "Stockholm"])).toBe(0);
  });

  it("tål små stavfel", () => {
    expect(smartMatchScore("koock", ["kock"])).toBeGreaterThan(0);
  });

  it("smartMatches speglar score > 0", () => {
    expect(smartMatches("elektriker", ["Elektriker"])).toBe(true);
    expect(smartMatches("astronaut", ["Elektriker"])).toBe(false);
  });
});
