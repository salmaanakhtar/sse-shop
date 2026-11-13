export const BADGE_TONES = ["brand", "neutral", "success", "warning"] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

export function isBadgeTone(value: string): value is BadgeTone {
  return (BADGE_TONES as readonly string[]).includes(value);
}

const TONE_CLASS: Record<BadgeTone, string> = {
  brand: "bg-brand text-white",
  neutral: "bg-zinc-900 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-400 text-amber-950",
};

export function badgeToneClass(tone: string): string {
  return TONE_CLASS[isBadgeTone(tone) ? tone : "brand"];
}
