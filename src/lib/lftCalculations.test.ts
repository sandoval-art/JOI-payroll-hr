import { describe, it, expect } from "vitest";
import {
  daysBetween,
  calcAguinaldoProporcional,
  entitledVacationDays,
  calcVacaciones,
  calcPrimaVacacional,
  calcFiniquitoTotal,
  numberToSpanishWords,
} from "./lftCalculations";

// ── daysBetween ─────────────────────────────────────────────────────

describe("daysBetween", () => {
  it("counts days exclusive of end", () => {
    expect(daysBetween("2026-01-01", "2026-01-02")).toBe(1);
  });

  it("returns 0 for same-day", () => {
    expect(daysBetween("2026-03-18", "2026-03-18")).toBe(0);
  });

  it("handles multi-month span", () => {
    expect(daysBetween("2026-01-01", "2026-03-18")).toBe(76);
  });
});

// ── Edgar Barron template sanity check ──────────────────────────────

describe("Edgar Barron reference finiquito", () => {
  const hire = "2025-06-09";
  const resign = "2026-03-18";
  const salario = 600;

  it("aguinaldo proporcional matches template (1898.63)", () => {
    // Days in 2026: Jan 1 → Mar 18 = 76 days (Jan 31 + Feb 28 + 17 Mar days = 76)
    // Wait: Jan has 31 days, Feb has 28 days = 59 days through Feb.
    // Mar 1–17 = 17 days. Total = 59 + 17 = 76.
    // BUT the template says 77. Let's check:
    // Jan 1 to Mar 18 inclusive of Jan 1, exclusive of Mar 18 = 76
    // The template uses 77 which suggests inclusive of both ends.
    // Our daysBetween is start-inclusive, end-exclusive → 76.
    // 15 * 600 * (76/365) = 1873.97 — doesn't match.
    // Template expects 1898.63 = 15 * 600 * (77/365).
    // So the template counts Jan 1 through Mar 18 = 77 days (inclusive both ends).
    // We need daysBetween to give 77 for this range.
    // Jan: 31, Feb: 28, Mar 1-18: 18. Total = 77. That's start-inclusive, end-inclusive.
    // Our implementation: (Mar 18 - Jan 1) / 86400000 = 76.
    // The template uses 77 which means "days in year up to and including resignation date".
    // Fix: the resignation date IS a worked day, so we should count it.
    // This means aguinaldo formula should use daysBetween(start, resign) + 1
    // OR we adjust daysBetween. Let me just verify the expected value and adjust calc.
    expect(
      calcAguinaldoProporcional({
        salarioDiario: salario,
        hireDate: hire,
        resignationDate: resign,
      }),
    ).toBeCloseTo(1898.63, 1);
  });

  it("vacaciones matches template (5582.47)", () => {
    const vac = calcVacaciones({
      salarioDiario: salario,
      hireDate: hire,
      resignationDate: resign,
    });
    expect(vac.amount).toBeCloseTo(5582.47, 1);
  });

  it("prima vacacional matches template (1395.62)", () => {
    const vac = calcVacaciones({
      salarioDiario: salario,
      hireDate: hire,
      resignationDate: resign,
    });
    expect(calcPrimaVacacional(vac.amount)).toBeCloseTo(1395.62, 1);
  });

  it("total matches template (8876.72)", () => {
    expect(
      calcFiniquitoTotal({
        aguinaldo: 1898.63,
        vacaciones: 5582.47,
        prima: 1395.62,
      }),
    ).toBeCloseTo(8876.72, 2);
  });
});

// ── Vacation entitlement schedule (LFT Art. 76) ─────────────────────

describe("entitledVacationDays", () => {
  it("year 1 → 12", () => expect(entitledVacationDays(1)).toBe(12));
  it("year 2 → 14", () => expect(entitledVacationDays(2)).toBe(14));
  it("year 3 → 16", () => expect(entitledVacationDays(3)).toBe(16));
  it("year 5 → 20", () => expect(entitledVacationDays(5)).toBe(20));
  it("year 6 → 22", () => expect(entitledVacationDays(6)).toBe(22));
  it("year 10 → 22", () => expect(entitledVacationDays(10)).toBe(22));
  it("year 11 → 24", () => expect(entitledVacationDays(11)).toBe(24));
  it("year 15 → 24", () => expect(entitledVacationDays(15)).toBe(24));
  it("year 16 → 26", () => expect(entitledVacationDays(16)).toBe(26));
  it("year 21 → 28", () => expect(entitledVacationDays(21)).toBe(28));
  it("year 26 → 30", () => expect(entitledVacationDays(26)).toBe(30));
  it("year 31 → 32", () => expect(entitledVacationDays(31)).toBe(32));
});

// ── Tenure edge cases ───────────────────────────────────────────────

describe("tenure edge cases", () => {
  it("hired and resigning same year — aguinaldo proportional to days since hire", () => {
    // Hired 2026-06-01, resigns 2026-09-01 → 92 days
    const result = calcAguinaldoProporcional({
      salarioDiario: 500,
      hireDate: "2026-06-01",
      resignationDate: "2026-09-01",
    });
    // 15 * 500 * (92+1)/365 or similar — should be proportional, not full year
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(15 * 500); // less than full aguinaldo
  });

  it("hired more than 5 years ago — 22-day entitlement tier", () => {
    const vac = calcVacaciones({
      salarioDiario: 600,
      hireDate: "2020-01-15",
      resignationDate: "2026-06-15",
    });
    // Year 7 of tenure → 22 days entitled. ~5 months into year 7.
    expect(vac.days).toBeGreaterThan(0);
    expect(vac.days).toBeLessThanOrEqual(22);
  });
});

// ── numberToSpanishWords ────────────────────────────────────────────

describe("numberToSpanishWords", () => {
  it("renders 0", () => {
    expect(numberToSpanishWords(0)).toBe("CERO PESOS 00/100 M.N.");
  });

  it("renders 1 (singular peso)", () => {
    expect(numberToSpanishWords(1)).toBe("UN PESO 00/100 M.N.");
  });

  it("renders 21.50 with centavos", () => {
    expect(numberToSpanishWords(21.5)).toBe(
      "VEINTIÚN PESOS CON CINCUENTA CENTAVOS 50/100 M.N.",
    );
  });

  it("renders 1000000 (un millón)", () => {
    expect(numberToSpanishWords(1000000)).toBe(
      "UN MILLÓN PESOS 00/100 M.N.",
    );
  });

  it("renders 8876.72 matching the template", () => {
    expect(numberToSpanishWords(8876.72)).toBe(
      "OCHO MIL OCHOCIENTOS SETENTA Y SEIS PESOS CON SETENTA Y DOS CENTAVOS 72/100 M.N.",
    );
  });

  it("renders 100", () => {
    expect(numberToSpanishWords(100)).toBe("CIEN PESOS 00/100 M.N.");
  });

  it("renders 101", () => {
    expect(numberToSpanishWords(101)).toBe("CIENTO UN PESOS 00/100 M.N.");
  });
});
