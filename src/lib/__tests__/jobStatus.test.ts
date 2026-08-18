import { describe, it, expect } from "vitest";
import {
  REPUBLISH_DAYS,
  getEmployerJobStatus,
  isEmployerJobActive,
  isEmployerJobDraft,
  isEmployerJobExpired,
} from "@/lib/jobStatus";

const inDays = (days: number) => new Date(Date.now() + days * 86400_000).toISOString();

describe("jobStatus", () => {
  it("behandlar aktiv annons med framtida utgång som aktiv", () => {
    const job = { is_active: true, expires_at: inDays(7) };
    expect(getEmployerJobStatus(job)).toBe("active");
    expect(isEmployerJobActive(job)).toBe(true);
    expect(isEmployerJobDraft(job)).toBe(false);
    expect(isEmployerJobExpired(job)).toBe(false);
  });

  it("markerar passerat utgångsdatum som utgången även om annonsen är aktiv", () => {
    const job = { is_active: true, expires_at: inDays(-1) };
    expect(getEmployerJobStatus(job)).toBe("expired");
    expect(isEmployerJobExpired(job)).toBe(true);
    expect(isEmployerJobActive(job)).toBe(false);
  });

  it("är utgången även när annonsen inte är aktiv", () => {
    const job = { is_active: false, expires_at: inDays(-3) };
    expect(getEmployerJobStatus(job)).toBe("expired");
  });

  it("räknar inaktiv annons utan utgångsdatum som utkast", () => {
    const job = { is_active: false, expires_at: null };
    expect(getEmployerJobStatus(job)).toBe("draft");
    expect(isEmployerJobDraft(job)).toBe(true);
  });

  it("räknar inaktiv annons med framtida utgång som utkast", () => {
    expect(getEmployerJobStatus({ is_active: false, expires_at: inDays(5) })).toBe("draft");
  });

  it("ignorerar ogiltiga datum istället för att krascha", () => {
    const job = { is_active: true, expires_at: "inte-ett-datum" };
    expect(isEmployerJobExpired(job)).toBe(false);
    expect(getEmployerJobStatus(job)).toBe("active");
  });

  it("återpublicering ger en aktiv annons under hela perioden", () => {
    expect(REPUBLISH_DAYS).toBe(14);
    const job = { is_active: true, expires_at: inDays(REPUBLISH_DAYS) };
    expect(getEmployerJobStatus(job)).toBe("active");
  });
});
