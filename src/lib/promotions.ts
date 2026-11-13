export type PromotionWindow = {
  active: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
};

export const PROMOTION_ROW_KINDS = ["category", "collection", "products"] as const;
export type PromotionRowKind = (typeof PROMOTION_ROW_KINDS)[number];

export function isPromotionRowKind(value: string): value is PromotionRowKind {
  return (PROMOTION_ROW_KINDS as readonly string[]).includes(value);
}

export function promotionPagePath(slug: string): string {
  return `/promotions/${slug}`;
}

function instant(value: Date | string | null): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

export function isPromotionLive(
  promotion: PromotionWindow,
  now: Date = new Date(),
): boolean {
  if (!promotion.active) return false;

  const nowMs = now.getTime();
  const startsAt = instant(promotion.startsAt);
  if (startsAt !== null && startsAt > nowMs) return false;

  const endsAt = instant(promotion.endsAt);
  if (endsAt !== null && endsAt <= nowMs) return false;

  return true;
}

export type PromotionStatus = "live" | "scheduled" | "expired" | "inactive";

export function promotionStatus(
  promotion: PromotionWindow,
  now: Date = new Date(),
): PromotionStatus {
  if (!promotion.active) return "inactive";

  const nowMs = now.getTime();
  const startsAt = instant(promotion.startsAt);
  const endsAt = instant(promotion.endsAt);

  if (endsAt !== null && endsAt <= nowMs) return "expired";
  if (startsAt !== null && startsAt > nowMs) return "scheduled";
  return "live";
}
