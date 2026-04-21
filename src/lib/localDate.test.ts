import { describe, it, expect } from "vitest";
import { formatDateMX, formatDateMXLong } from "./localDate";

describe("formatDateMX", () => {
  it("formats an ISO date string", () => {
    expect(formatDateMX("2026-04-12")).toBe("12/04/26");
  });

  it("formats a Date object", () => {
    expect(formatDateMX(new Date(2026, 3, 12))).toBe("12/04/26");
  });

  it("returns empty string for null", () => {
    expect(formatDateMX(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateMX(undefined)).toBe("");
  });

  it("returns empty string for invalid string", () => {
    expect(formatDateMX("not-a-date")).toBe("");
  });

  it("handles leap day", () => {
    expect(formatDateMX("2024-02-29")).toBe("29/02/24");
  });
});

describe("formatDateMXLong", () => {
  it("formats with 4-digit year", () => {
    expect(formatDateMXLong("2026-04-12")).toBe("12/04/2026");
  });

  it("pads single-digit day and month", () => {
    expect(formatDateMXLong("2026-01-05")).toBe("05/01/2026");
  });
});
