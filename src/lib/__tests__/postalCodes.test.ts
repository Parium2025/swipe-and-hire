import { describe, it, expect } from "vitest";
import { findLocationByPostalCode, isValidPostalCodeFormat, formatPostalCode, swedishPostalCodes } from "@/lib/postalCodes";

describe("findLocationByPostalCode", () => {
  it("hittar Stockholm för känt postnummer", () => {
    expect(findLocationByPostalCode("111 20")?.city).toBe("Stockholm");
  });

  it("hittar Göteborg och Malmö", () => {
    expect(findLocationByPostalCode("411 01")?.city).toBe("Göteborg");
    expect(findLocationByPostalCode("211 15")?.city).toBe("Malmö");
  });

  it("normaliserar bort extra mellanslag", () => {
    expect(findLocationByPostalCode("  111  20 ")?.city).toBe("Stockholm");
  });

  it("returnerar null för okänt postnummer", () => {
    expect(findLocationByPostalCode("999 99")).toBeNull();
  });
});

describe("isValidPostalCodeFormat", () => {
  it("godtar svenskt XXX XX-format", () => {
    expect(isValidPostalCodeFormat("111 20")).toBe(true);
    expect(isValidPostalCodeFormat("  411 01  ")).toBe(true);
  });

  it("avvisar fel format", () => {
    expect(isValidPostalCodeFormat("11120")).toBe(false);
    expect(isValidPostalCodeFormat("111 2")).toBe(false);
    expect(isValidPostalCodeFormat("abc de")).toBe(false);
  });
});

describe("formatPostalCode", () => {
  it("formaterar fem siffror till XXX XX", () => {
    expect(formatPostalCode("11120")).toBe("111 20");
  });

  it("rensar bort icke-siffror först", () => {
    expect(formatPostalCode("11-12a0")).toBe("111 20");
  });

  it("lämnar ofullständiga nummer ofullständiga", () => {
    expect(formatPostalCode("12")).toBe("12");
    expect(formatPostalCode("123")).toBe("123");
  });
});

describe("datamängd", () => {
  it("innehåller bara giltiga svenska postnummer", () => {
    for (const row of swedishPostalCodes) {
      expect(isValidPostalCodeFormat(row.postalCode), `Ogiltigt format: ${row.postalCode}`).toBe(true);
      expect(row.city.length, `Saknar stad: ${row.postalCode}`).toBeGreaterThan(0);
    }
  });

  it("har inga dubbletter", () => {
    const codes = swedishPostalCodes.map((r) => r.postalCode);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
