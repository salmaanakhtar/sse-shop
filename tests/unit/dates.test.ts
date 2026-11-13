import { describe, expect, it } from "vitest";
import { formatDubaiDateTimeInput, parseDubaiDateTimeInput } from "@/lib/dates";

describe("parseDubaiDateTimeInput", () => {
  it("parses an empty value as no bound", () => {
    expect(parseDubaiDateTimeInput("")).toBeNull();
  });

  it("interprets the wall clock as Asia/Dubai", () => {
    const parsed = parseDubaiDateTimeInput("2026-11-13T10:30");
    expect(parsed).toBeInstanceOf(Date);
    if (parsed instanceof Date) {
      expect(parsed.toISOString()).toBe("2026-11-13T06:30:00.000Z");
    }
  });

  it("rejects an impossible value", () => {
    expect(parseDubaiDateTimeInput("not-a-date")).toBe("invalid");
  });
});

describe("formatDubaiDateTimeInput", () => {
  it("round-trips through the Dubai input format", () => {
    expect(formatDubaiDateTimeInput(new Date("2026-11-13T06:30:00.000Z"))).toBe(
      "2026-11-13T10:30",
    );
  });

  it("renders an empty value for no date", () => {
    expect(formatDubaiDateTimeInput(null)).toBe("");
  });
});
