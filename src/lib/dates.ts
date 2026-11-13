export const STORE_TIME_ZONE = "Asia/Dubai";
const DUBAI_OFFSET = "+04:00";

/**
 * HTML datetime-local has no timezone. The admin edits sale windows in the
 * store's timezone, so parse the wall clock as Asia/Dubai (UTC+4).
 */
export function parseDubaiDateTimeInput(value: string): Date | null | "invalid" {
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const withOffset = /(?:Z|[+-]\d{2}:\d{2})$/.test(trimmed)
    ? trimmed
    : `${trimmed}${DUBAI_OFFSET}`;
  const date = new Date(withOffset);

  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

export function formatDubaiDateTimeInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function formatDubaiDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-AE", {
    timeZone: STORE_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}