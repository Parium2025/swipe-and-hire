import { describe, it, expect, beforeEach } from "vitest";
import {
  NOTES_STORAGE_KEY,
  SUMMARY_STORAGE_KEY,
  getPersistedCacheValue,
  getPersistedNotes,
  setPersistedCacheValue,
  setPersistedNotes,
  type CandidateNote,
} from "@/components/candidateProfile/candidateProfileCache";
import { AVATAR_TRANSFORM, PROFILE_IMAGE_TRANSFORM, MEDIA_URL_TTL } from "@/lib/mediaPresets";

const note = (id: string): CandidateNote => ({
  id,
  note: `Anteckning ${id}`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  employer_id: "emp-1",
});

describe("candidateProfileCache", () => {
  beforeEach(() => localStorage.clear());

  it("returnerar null för okänd nyckel", () => {
    expect(getPersistedCacheValue(SUMMARY_STORAGE_KEY, "saknas")).toBeNull();
  });

  it("sparar och läser tillbaka ett värde", () => {
    setPersistedCacheValue(SUMMARY_STORAGE_KEY, "app-1", { summary_text: "Hej", key_points: null });
    expect(getPersistedCacheValue<{ summary_text: string }>(SUMMARY_STORAGE_KEY, "app-1")?.summary_text).toBe("Hej");
  });

  it("håller anteckningar isolerade per kandidat", () => {
    setPersistedNotes("kand-1", [note("a")]);
    setPersistedNotes("kand-2", [note("b"), note("c")]);
    expect(getPersistedNotes("kand-1")).toHaveLength(1);
    expect(getPersistedNotes("kand-2")).toHaveLength(2);
    expect(getPersistedNotes("kand-3")).toBeNull();
  });

  it("överlever trasig localStorage-data utan att krascha", () => {
    localStorage.setItem(NOTES_STORAGE_KEY, "{trasig json");
    expect(getPersistedNotes("kand-1")).toBeNull();
    setPersistedNotes("kand-1", [note("a")]);
    expect(getPersistedNotes("kand-1")).toHaveLength(1);
  });

  it("beskär cachen till max antal poster och behåller de nyaste", () => {
    for (let i = 0; i < 420; i++) setPersistedCacheValue(SUMMARY_STORAGE_KEY, `app-${i}`, { summary_text: `${i}` });
    const raw = JSON.parse(localStorage.getItem(SUMMARY_STORAGE_KEY) || "{}");
    expect(Object.keys(raw).length).toBeLessThanOrEqual(400);
    expect(getPersistedCacheValue(SUMMARY_STORAGE_KEY, "app-419")).not.toBeNull();
  });
});

describe("mediaPresets", () => {
  it("är låsta så att warmup och rendering delar cache-nyckel", () => {
    expect(AVATAR_TRANSFORM).toEqual({ width: 40, height: 40, resize: "cover" });
    expect(PROFILE_IMAGE_TRANSFORM).toEqual({ width: 200, height: 200, resize: "cover" });
    expect(MEDIA_URL_TTL).toBe(86400);
  });
});
