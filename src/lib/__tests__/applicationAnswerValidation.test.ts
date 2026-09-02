import { describe, it, expect } from "vitest";
import {
  isApplicationAnswerPresent,
  hasAllRequiredApplicationAnswers,
  isPermanentApplicationError,
} from "@/lib/applicationAnswerValidation";

describe("isApplicationAnswerPresent", () => {
  it("saknas för null, undefined och tomma strängar", () => {
    expect(isApplicationAnswerPresent(null)).toBe(false);
    expect(isApplicationAnswerPresent(undefined)).toBe(false);
    expect(isApplicationAnswerPresent("   ")).toBe(false);
  });

  it("saknas för tomma arrayer och objekt", () => {
    expect(isApplicationAnswerPresent([])).toBe(false);
    expect(isApplicationAnswerPresent({})).toBe(false);
  });

  it("räknas för ifyllda värden", () => {
    expect(isApplicationAnswerPresent("Ja")).toBe(true);
    expect(isApplicationAnswerPresent(["alt1"])).toBe(true);
    expect(isApplicationAnswerPresent({ val: 1 })).toBe(true);
    expect(isApplicationAnswerPresent(false)).toBe(true);
    expect(isApplicationAnswerPresent(0)).toBe(true);
  });
});

describe("hasAllRequiredApplicationAnswers", () => {
  const questions = [
    { id: "q1", is_required: true },
    { id: "q2", is_required: false },
    { id: "q3", is_required: true },
  ];

  it("godkänner när alla obligatoriska är besvarade", () => {
    expect(hasAllRequiredApplicationAnswers(questions, { q1: "a", q3: ["b"] })).toBe(true);
  });

  it("underkänner när en obligatorisk saknas även om valfria är ifyllda", () => {
    expect(hasAllRequiredApplicationAnswers(questions, { q1: "a", q2: "b" })).toBe(false);
  });

  it("godkänner när det inte finns obligatoriska frågor", () => {
    expect(hasAllRequiredApplicationAnswers([{ id: "q2", is_required: false }], {})).toBe(true);
  });
});

describe("isPermanentApplicationError", () => {
  it("klassar databas-begränsningar som permanenta", () => {
    expect(isPermanentApplicationError({ code: "23505" })).toBe(true);
    expect(isPermanentApplicationError({ code: "23514" })).toBe(true);
    expect(isPermanentApplicationError({ code: "42501" })).toBe(true);
  });

  it("klassar kvot- och svars-fel som permanenta", () => {
    expect(isPermanentApplicationError({ message: "application_quota_exceeded" })).toBe(true);
    expect(isPermanentApplicationError({ message: "required_application_answer_missing" })).toBe(true);
  });

  it("klassar tillfälliga nätverksfel som icke-permanenta", () => {
    expect(isPermanentApplicationError({ message: "Failed to fetch" })).toBe(false);
    expect(isPermanentApplicationError(null)).toBe(false);
    expect(isPermanentApplicationError(new Error("timeout"))).toBe(false);
  });
});
