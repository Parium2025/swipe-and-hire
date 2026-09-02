import { describe, it, expect } from "vitest";
import { getCompanyInitials } from "@/lib/companyInitials";

describe("getCompanyInitials", () => {
  it("returnerar '?' utan namn", () => {
    expect(getCompanyInitials()).toBe("?");
    expect(getCompanyInitials(null)).toBe("?");
    expect(getCompanyInitials("   ")).toBe("?");
  });

  it("använder första + sista bokstaven för ett ord", () => {
    expect(getCompanyInitials("Apple")).toBe("AE");
    expect(getCompanyInitials("Hoffstens")).toBe("HS");
  });

  it("använder första bokstaven i första och sista ordet", () => {
    expect(getCompanyInitials("Hoffstens Motor")).toBe("HM");
    expect(getCompanyInitials("Volvo Cars Group")).toBe("VG");
  });

  it("normaliserar gemener till versaler", () => {
    expect(getCompanyInitials("acme transport")).toBe("AT");
  });

  it("ignorerar extra mellanslag", () => {
    expect(getCompanyInitials("  AB   Hult & Söner  ")).toBe("AS");
  });
});
