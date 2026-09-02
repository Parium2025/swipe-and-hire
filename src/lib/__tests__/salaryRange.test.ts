import { describe, it, expect } from "vitest";
import { parseSalary, formatSalary } from "@/lib/salaryRange";
import { getJobBadgeSalary } from "@/lib/swipeJobSalary";

describe("parseSalary", () => {
  it("läser numeriska min/max som månadslön", () => {
    const parsed = parseSalary({ salary_min: 30000, salary_max: 40000 });
    expect(parsed).toEqual({ min: 30000, max: 40000, unitText: "MONTH", unitLabel: "kr/mån", afterInterview: false });
  });

  it("markerar timlön utifrån salary_type", () => {
    const parsed = parseSalary({ salary_min: 180, salary_type: "timlön" });
    expect(parsed?.unitText).toBe("HOUR");
    expect(parsed?.unitLabel).toBe("kr/tim");
  });

  it("tolkar after_interview som lönesamtal", () => {
    const parsed = parseSalary({ salary_transparency: "after_interview" });
    expect(parsed?.afterInterview).toBe(true);
    expect(parsed?.min).toBeNull();
  });

  it("parsar intervall i salary_transparency när numeriska fält saknas", () => {
    const parsed = parseSalary({ salary_transparency: "30000-40000" });
    expect(parsed?.min).toBe(30000);
    expect(parsed?.max).toBe(40000);
  });

  it("parsar enstaka tal i salary_transparency", () => {
    expect(parseSalary({ salary_transparency: "35000" })?.min).toBe(35000);
  });

  it("returnerar null när inget lönedata finns", () => {
    expect(parseSalary({})).toBeNull();
    expect(parseSalary({ salary_transparency: "oklart" })).toBeNull();
  });
});

describe("formatSalary", () => {
  it("formaterar intervall på svenska", () => {
    expect(formatSalary({ salary_min: 30000, salary_max: 40000 })).toBe('30 000 – 40 000 kr/mån'.replaceAll(' ', '\u00A0'));
  });

  it("visar intervjutexten för after_interview", () => {
    expect(formatSalary({ salary_transparency: "after_interview" })).toBe("Lön diskuteras vid intervju");
  });

  it("returnerar null utan lönedata", () => {
    expect(formatSalary({})).toBeNull();
  });
});

describe("getJobBadgeSalary (swipe)", () => {
  it("använder svensk intervju-etikett för after_interview", () => {
    expect(getJobBadgeSalary({ salary_transparency: "after_interview" })).toBe("Lön efter intervju");
  });

  it("formaterar intervall i badgen", () => {
    const text = getJobBadgeSalary({ salary_min: 25000, salary_max: 30000, salary_type: "monthly" });
    expect(text).toBe('25 000 – 30 000 kr/mån'.replaceAll(' ', '\u00A0'));
  });

  it("faller tillbaka på salary_transparency-intervall", () => {
    expect(getJobBadgeSalary({ salary_transparency: "200-250", salary_type: "hourly" })).toBe("200 – 250 kr/tim");
  });

  it("returnerar null helt utan lönedata", () => {
    expect(getJobBadgeSalary({})).toBeNull();
  });
});
