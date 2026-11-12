import { describe, expect, it } from "vitest";
import { isUuidv7, uuidv7 } from "@/lib/id";

describe("uuidv7", () => {
  it("produces a well-formed version 7 uuid", () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(isUuidv7(id)).toBe(true);
  });

  it("is unique across many calls", () => {
    const ids = new Set(Array.from({ length: 5_000 }, () => uuidv7()));
    expect(ids.size).toBe(5_000);
  });

  it("sorts in creation order, which is the point of v7", () => {
    const ids = Array.from({ length: 500 }, () => uuidv7());
    const sorted = [...ids].sort();
    expect(sorted).toEqual(ids);
  });

  it("rejects strings that only look like uuids", () => {
    expect(isUuidv7("not-a-uuid")).toBe(false);
    expect(isUuidv7("018f2b7c-0000-4000-8000-000000000000")).toBe(false); // v4
    expect(isUuidv7("018f2b7c-0000-7000-c000-000000000000")).toBe(false); // wrong variant
  });
});
