export type VariantOption = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

export type VariantCombination = {
  key: string;
  optionValueIds: string[];
  labels: string[];
};

/**
 * A stable key for a set of option values. Order does not matter: the same
 * combination reached by two code paths must collide.
 */
export function combinationKey(valueIds: readonly string[]): string {
  return [...valueIds].sort().join("|");
}

/**
 * The full Cartesian product of the product's options. Returns an empty list
 * when there are no options or when any option is still missing values, so the
 * admin UI can show a complete "not ready yet" state instead of a partial one.
 */
export function buildCombinations(options: readonly VariantOption[]): VariantCombination[] {
  if (options.length === 0) return [];
  if (options.some((option) => option.values.length === 0)) return [];

  let combinations: { optionValueIds: string[]; labels: string[] }[] = [
    { optionValueIds: [], labels: [] },
  ];

  for (const option of options) {
    combinations = combinations.flatMap((combination) =>
      option.values.map((value) => ({
        optionValueIds: [...combination.optionValueIds, value.id],
        labels: [...combination.labels, value.value],
      })),
    );
  }

  return combinations.map((combination) => ({
    ...combination,
    key: combinationKey(combination.optionValueIds),
  }));
}

/** Human labels for one variant, in the product's option order. */
export function describeVariant(
  options: readonly VariantOption[],
  optionValueIds: readonly string[],
): string[] {
  return options
    .map((option) => {
      const value = option.values.find((candidate) => optionValueIds.includes(candidate.id));
      return value ? `${option.name}: ${value.value}` : null;
    })
    .filter((label): label is string => Boolean(label));
}
