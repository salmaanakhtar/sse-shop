import { describe, expect, it } from "vitest";
import { buildCombinations, combinationKey, describeVariant } from "@/lib/variants";

const colour = {
  id: "colour",
  name: "Colour",
  values: [
    { id: "black", value: "Black" },
    { id: "white", value: "White" },
  ],
};

const spec = {
  id: "spec",
  name: "Spec",
  values: [
    { id: "4060", value: "RTX 4060" },
    { id: "4070", value: "RTX 4070" },
    { id: "4080", value: "RTX 4080" },
  ],
};

describe("buildCombinations", () => {
  it("builds the full Cartesian product in option order", () => {
    const combinations = buildCombinations([colour, spec]);

    expect(combinations).toHaveLength(6);
    expect(combinations[0]?.labels).toEqual(["Black", "RTX 4060"]);
    expect(combinations[5]?.labels).toEqual(["White", "RTX 4080"]);
  });

  it("gives each combination a stable order-independent key", () => {
    const combinations = buildCombinations([colour, spec]);
    const keys = new Set(combinations.map((combination) => combination.key));

    expect(keys.size).toBe(6);
    expect(combinationKey(["white", "4070"])).toBe(combinationKey(["4070", "white"]));
  });

  it("returns nothing until every option has at least one value", () => {
    expect(buildCombinations([])).toEqual([]);
    expect(buildCombinations([colour, { ...spec, values: [] }])).toEqual([]);
  });
});

describe("describeVariant", () => {
  it("labels a variant in the product's option order", () => {
    expect(describeVariant([colour, spec], ["white", "4070"])).toEqual([
      "Colour: White",
      "Spec: RTX 4070",
    ]);
  });
});
