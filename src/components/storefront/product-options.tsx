"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/app/(storefront)/cart-actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type OptionGroup = {
  id: string;
  name: string;
  values: { id: string; value: string }[];
};

type Variant = {
  id: string;
  title: string;
  priceMinor: number;
  stockQty: number;
  optionValueIds: string[];
};

type Props = {
  options: OptionGroup[];
  variants: Variant[];
};

export function ProductOptions({ options, variants }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const first = variants[0];
    const initial: Record<string, string> = {};
    for (const option of options) {
      const value = option.values.find((candidate) => first?.optionValueIds.includes(candidate.id));
      if (value) initial[option.id] = value.id;
    }
    return initial;
  });

  const variant =
    options.length === 0
      ? variants[0]
      : variants.find(
          (candidate) =>
            options.every((option) => candidate.optionValueIds.includes(selected[option.id] ?? "")),
        );

  const soldOut = !variant || variant.stockQty === 0;

  function add() {
    if (!variant) return;
    setMessage(null);
    startTransition(async () => {
      const result = await addToCartAction(variant.id, 1);
      if (result.ok) {
        setMessage({ kind: "ok", text: "Added to cart." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {options.map((option) => (
          <fieldset key={option.id}>
            <legend className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {option.name}
            </legend>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[option.id] === value.id;
                return (
                  <button
                    key={value.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setSelected((current) => ({ ...current, [option.id]: value.id }));
                      setMessage(null);
                    }}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-sm transition-colors",
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-surface text-ink hover:border-ink/40",
                    )}
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex items-baseline justify-between border-t border-line pt-5">
        <div>
          <p className="text-xl font-semibold tabular-nums">
            {variant ? formatMoney(variant.priceMinor) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {soldOut ? "Sold out" : `${variant.stockQty} in stock`}
          </p>
        </div>
        <p className="text-xs text-muted">VAT included</p>
      </div>

      <div className="space-y-3">
        <Button onClick={add} disabled={pending || soldOut} className="w-full" data-testid="add-to-cart">
          {soldOut ? "Sold out" : pending ? "Adding…" : "Add to cart"}
        </Button>

        {message ? (
          <p
            role="status"
            className={cn(
              "text-sm",
              message.kind === "ok" ? "text-emerald-700" : "text-red-600",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
