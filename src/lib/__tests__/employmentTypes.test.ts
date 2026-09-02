import { describe, it, expect } from "vitest";
import {
  getEmploymentTypeLabel,
  getEmploymentTypeByLabel,
  normalizeEmploymentType,
  formatDuration,
  formatPartTimeDays,
  formatPartTimeShifts,
  formatEmploymentDetails,
  EMPLOYMENT_TYPES,
} from "@/lib/employmentTypes";

describe("etiketter och normalisering", () => {
  it("mappar kod till svensk etikett", () => {
    expect(getEmploymentTypeLabel("full_time")).toBe("Heltid");
    expect(getEmploymentTypeLabel("summer_job")).toBe("Sommarjobb");
  });

  it("lämnar okända värden och tomt orörda", () => {
    expect(getEmploymentTypeLabel("nagot_annat")).toBe("nagot_annat");
    expect(getEmploymentTypeLabel(undefined)).toBe("");
  });

  it("normaliserar gamla display-etiketter till koder", () => {
    expect(normalizeEmploymentType("Heltid")).toBe("full_time");
    expect(normalizeEmploymentType("Vikariat")).toBe("temporary");
    expect(normalizeEmploymentType("part_time")).toBe("part_time");
  });

  it("hittar typ via etikett", () => {
    expect(getEmploymentTypeByLabel("Praktik")?.value).toBe("internship");
  });

  it("alla koder är unika", () => {
    const values = EMPLOYMENT_TYPES.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("formatDuration", () => {
  it("använder singular för 1", () => {
    expect(formatDuration(1, "weeks")).toBe("1 vecka");
    expect(formatDuration(1, "months")).toBe("1 månad");
  });

  it("använder plural för flera", () => {
    expect(formatDuration(6, "months")).toBe("6 månader");
    expect(formatDuration(3, "weeks")).toBe("3 veckor");
  });

  it("returnerar tomt utan giltiga värden", () => {
    expect(formatDuration(0, "weeks")).toBe("");
    expect(formatDuration(undefined, "months")).toBe("");
    expect(formatDuration(3, "okant")).toBe("");
  });
});

describe("deltid och skift", () => {
  it("sorterar veckodagar i kalenderordning oavsett inordning", () => {
    expect(formatPartTimeDays(["fri", "mon", "wed"])).toBe("Mån, Ons, Fre");
  });

  it("returnerar tomt utan dagar", () => {
    expect(formatPartTimeDays(null)).toBe("");
    expect(formatPartTimeDays([])).toBe("");
  });

  it("formatEmploymentDetails: deltid visar dagar och skift", () => {
    const text = formatEmploymentDetails({ employment_type: "part_time", part_time_days: ["mon"] });
    expect(text).toContain("Mån");
  });

  it("formatEmploymentDetails: vikariat visar ungefärlig längd", () => {
    expect(formatEmploymentDetails({ employment_type: "temporary", duration_amount: 6, duration_unit: "months" })).toBe("ca 6 månader");
  });

  it("formatEmploymentDetails: heltid utan extradetaljer blir tomt", () => {
    expect(formatEmploymentDetails({ employment_type: "full_time" })).toBe("");
    expect(formatEmploymentDetails({})).toBe("");
  });
});
