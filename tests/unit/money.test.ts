import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney, vatComponent, divRoundHalfUp } from "@/lib/money";

describe("formatMoney", () => {
  it("renders integer fils as dirhams", () => {
    expect(formatMoney(24_000)).toMatch(/^AED\s240\.00$/);
    expect(formatMoney(0)).toMatch(/^AED\s0\.00$/);
    expect(formatMoney(1_143)).toMatch(/^AED\s11\.43$/);
  });

  it("refuses a non-integer amount", () => {
    expect(() => formatMoney(240.5)).toThrow(TypeError);
  });
});

describe("parseMoney", () => {
  it("parses plain and decimal input", () => {
    expect(parseMoney("240")).toBe(24_000);
    expect(parseMoney("240.5")).toBe(24_050);
    expect(parseMoney("240.05")).toBe(24_005);
    expect(parseMoney("0")).toBe(0);
    expect(parseMoney("0.99")).toBe(99);
  });

  it("tolerates thousands separators and whitespace", () => {
    expect(parseMoney(" 1,240.00 ")).toBe(124_000);
    expect(parseMoney("1 240.00")).toBe(124_000);
  });

  it("rejects ambiguous or invalid input instead of guessing", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("240.001")).toBeNull();
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1,2,3.00")).toBeNull();
    expect(parseMoney("240.")).toBeNull();
    expect(parseMoney(".5")).toBeNull();
  });

  it("round-trips a formatted amount", () => {
    expect(parseMoney("240.00")).toBe(24_000);
  });
});

describe("divRoundHalfUp", () => {
  it("rounds .5 away from zero for positives", () => {
    expect(divRoundHalfUp(1, 2)).toBe(1);
    expect(divRoundHalfUp(3, 2)).toBe(2);
    expect(divRoundHalfUp(5, 2)).toBe(3);
    expect(divRoundHalfUp(1, 3)).toBe(0);
    expect(divRoundHalfUp(2, 3)).toBe(1);
  });

  it("rejects a zero denominator", () => {
    expect(() => divRoundHalfUp(1, 0)).toThrow(TypeError);
  });
});

describe("vatComponent", () => {
  it("extracts the VAT already inside a total", () => {
    expect(vatComponent(24_000, 500)).toBe(1_143);
    expect(vatComponent(14_000, 500)).toBe(667);
    expect(vatComponent(0, 500)).toBe(0);
  });

  it("keeps the component strictly inside the total", () => {
    for (const total of [1, 99, 1_000, 24_000, 99_999, 1_000_000]) {
      const tax = vatComponent(total, 500);
      expect(tax).toBeLessThanOrEqual(total);
      expect(total - tax).toBeGreaterThanOrEqual(0);
    }
  });

  it("matches a fifth of the net amount at 5%", () => {
    // VAT-inclusive: net = total / 1.05, so tax = net * 0.05 = total / 21.
    expect(vatComponent(21_000, 500)).toBe(1_000);
  });

  it("rejects a negative total", () => {
    expect(() => vatComponent(-1, 500)).toThrow(TypeError);
  });
});
