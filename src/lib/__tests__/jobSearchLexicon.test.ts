import { describe, it, expect } from "vitest";
import { expandSearchToken } from "../../../supabase/functions/_shared/jobSearchLexicon.ts";
import { smartMatches } from "@/lib/seoSearch";

const has = (q: string, t: string) => expandSearchToken(q).includes(t);

describe("gemensam sökordlista", () => {
  it("synonymkluster åt båda håll", () => {
    expect(has("budbil", "chauffor")).toBe(true);
    expect(has("chaufför", "kurir")).toBe(true);
    expect(has("usk", "underskoterska")).toBe(true);
    expect(has("lager", "plockare")).toBe(true);
  });
  it("kända och okända stavfel", () => {
    expect(has("utveklare", "utvecklare")).toBe(true);
    expect(has("elektrikr", "elektriker")).toBe(true);
    expect(has("stocholm", "stockholm")).toBe(true);
  });
  it("böjningar", () => {
    expect(has("chaufförer", "chauffor")).toBe(true);
  });
  it("SEO-sökrutor använder samma motor", () => {
    expect(smartMatches("budbil", ["Chaufför"])).toBe(true);
    expect(smartMatches("plockare", ["Lagerarbetare"])).toBe(true);
  });
});
