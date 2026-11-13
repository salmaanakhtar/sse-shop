import { describe, expect, it } from "vitest";
import { db } from "@/server/db/client";
import { promotions } from "@/server/db/schema";
import {
  deletePromotion,
  listActivePromotions,
  listAdminPromotions,
  movePromotion,
} from "@/server/services/promotions";

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createPromotionRow(input: {
  headline: string;
  position: number;
  active?: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  const [row] = await db
    .insert(promotions)
    .values({
      headline: input.headline,
      subheadline: "",
      ctaLabel: "Shop now",
      href: "/products/essential-tee",
      imageKey: `2026/11/${suffix()}.webp`,
      imageAlt: input.headline,
      active: input.active ?? true,
      position: input.position,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    })
    .returning();
  if (!row) throw new Error("could not create the test promotion");
  return row;
}

describe("promotions", () => {
  it("lists only live slides in position order", async () => {
    const now = new Date("2026-06-01T12:00:00.000Z");

    const second = await createPromotionRow({ headline: "Second", position: 1 });
    const first = await createPromotionRow({ headline: "First", position: 0 });
    await createPromotionRow({
      headline: "Future",
      position: 2,
      startsAt: new Date("2026-06-02T00:00:00.000Z"),
    });
    await createPromotionRow({
      headline: "Expired",
      position: 3,
      endsAt: new Date("2026-06-01T11:00:00.000Z"),
    });
    await createPromotionRow({ headline: "Inactive", position: 4, active: false });

    const live = await listActivePromotions(now);
    const liveHeadlines = live.map((slide) => slide.headline);
    expect(liveHeadlines).toEqual(["First", "Second"]);
    expect(live[0]?.id).toBe(first.id);
    expect(live[1]?.id).toBe(second.id);
  });

  it("shows statuses in the admin list and swaps order", async () => {
    const first = await createPromotionRow({ headline: "Swap A", position: 10 });
    const second = await createPromotionRow({ headline: "Swap B", position: 11 });

    expect(await movePromotion(second.id, "up")).toBe(true);

    const admin = await listAdminPromotions();
    const ordered = admin.filter((row) => row.id === first.id || row.id === second.id);
    expect(ordered.map((row) => row.headline)).toEqual(["Swap B", "Swap A"]);
    expect(ordered[0]?.status).toBe("live");

    const deleted = await deletePromotion(first.id);
    expect(deleted?.id).toBe(first.id);
    expect((await listAdminPromotions()).some((row) => row.id === first.id)).toBe(false);
  });
});
