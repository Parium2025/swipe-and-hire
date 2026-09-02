import { describe, it, expect } from "vitest";
import { validateSwedishPhoneNumber, isValidSwedishPhone } from "@/lib/phoneValidation";

describe("validateSwedishPhoneNumber", () => {
  it("kräver nummer när fältet är obligatoriskt", () => {
    const result = validateSwedishPhoneNumber("  ");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("obligatoriskt");
  });

  it("tillåter tomt fält när det inte är obligatoriskt", () => {
    expect(validateSwedishPhoneNumber("", false).isValid).toBe(true);
  });

  it("godtar 07X-format med 10 siffror", () => {
    expect(validateSwedishPhoneNumber("0701234567").isValid).toBe(true);
    expect(validateSwedishPhoneNumber("076-123 45 67").isValid).toBe(true);
  });

  it("avvisar fasta nummer som börjar med 08", () => {
    expect(validateSwedishPhoneNumber("0812345678").isValid).toBe(false);
  });

  it("godtar +46-format med exakt 9 siffror", () => {
    expect(validateSwedishPhoneNumber("+46701234567").isValid).toBe(true);
    expect(validateSwedishPhoneNumber("+46 73 123 45 67").isValid).toBe(true);
  });

  it("avvisar +46 med fel antal siffror", () => {
    expect(validateSwedishPhoneNumber("+4670123456").isValid).toBe(false);
    expect(validateSwedishPhoneNumber("+467012345678").isValid).toBe(false);
  });

  it("godtar 0046-format", () => {
    expect(validateSwedishPhoneNumber("0046701234567").isValid).toBe(true);
  });

  it("godtar 9 siffror utan nolla", () => {
    expect(validateSwedishPhoneNumber("701234567").isValid).toBe(true);
  });

  it("avvisar mobilprefix utanför 70–76", () => {
    expect(validateSwedishPhoneNumber("0771234567").isValid).toBe(false);
    expect(validateSwedishPhoneNumber("+46771234567").isValid).toBe(false);
  });

  it("avvisar rena bokstäver", () => {
    expect(validateSwedishPhoneNumber("hej hej").isValid).toBe(false);
  });
});

describe("isValidSwedishPhone", () => {
  it("godtar vanliga svenska format", () => {
    expect(isValidSwedishPhone("070 123 45 67")).toBe(true);
    expect(isValidSwedishPhone("+46701234567")).toBe(true);
  });

  it("avvisar för korta nummer och noll-prefix", () => {
    expect(isValidSwedishPhone("0701234")).toBe(false);
    expect(isValidSwedishPhone("001234567")).toBe(false);
  });
});
