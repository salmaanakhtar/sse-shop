import { describe, expect, it } from "vitest";
import { addressFromFormData, addressSchema, formatAddress } from "@/lib/address";

const valid = {
  fullName: "Ayesha Khan",
  phone: "+971501234567",
  emirate: "Dubai" as const,
  street: "Al Wasl Road",
  building: "Villa 12",
  area: "Jumeirah 1",
};

describe("addressSchema", () => {
  it("accepts a UAE address and defaults the optional lines", () => {
    const parsed = addressSchema.parse(valid);

    expect(parsed.area).toBe("Jumeirah 1");
    expect(parsed.poBox).toBe("");
    expect(parsed.notes).toBe("");
  });

  it("rejects a phone that is not +971 plus nine digits", () => {
    expect(() => addressSchema.parse({ ...valid, phone: "0501234567" })).toThrow();
    expect(() => addressSchema.parse({ ...valid, phone: "+97150123" })).toThrow();
  });

  it("rejects an emirate outside the seven", () => {
    expect(() => addressSchema.parse({ ...valid, emirate: "Doha" })).toThrow();
  });
});

describe("formatAddress", () => {
  it("prints the area between building and emirate", () => {
    expect(formatAddress(addressSchema.parse(valid))).toEqual([
      "Ayesha Khan",
      "Villa 12, Al Wasl Road",
      "Jumeirah 1",
      "Dubai",
      "+971501234567",
    ]);
  });

  it("keeps a PO box when present", () => {
    const lines = formatAddress(addressSchema.parse({ ...valid, poBox: "12345" }));
    expect(lines).toContain("PO Box 12345");
  });
});

describe("addressFromFormData", () => {
  it("reads prefixed billing fields", () => {
    const form = new FormData();
    form.set("billingFullName", "Ayesha Khan");
    form.set("billingPhone", "+971501234567");
    form.set("billingEmirate", "Dubai");
    form.set("billingStreet", "Al Wasl Road");
    form.set("billingBuilding", "Villa 12");
    form.set("billingArea", "Jumeirah 1");

    const parsed = addressFromFormData(form, "billing");
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.fullName).toBe("Ayesha Khan");
      expect(parsed.data.area).toBe("Jumeirah 1");
    }
  });

  it("returns a readable failure for an empty form", () => {
    const parsed = addressFromFormData(new FormData());
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/recipient/i);
    }
  });
});
