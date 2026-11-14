import type { Metadata } from "next";
import Link from "next/link";
import { subscribeNewsletterAction } from "@/app/(storefront)/newsletter-actions";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { localePath, translate } from "@/lib/i18n";
import { getLocale } from "@/server/services/preferences";

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Occasional product news and offers, confirmed by email.",
};

export default async function NewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; confirmed?: string; unsubscribed?: string; error?: string }>;
}) {
  const [{ status, confirmed, unsubscribed, error }, locale] = await Promise.all([
    searchParams,
    getLocale(),
  ]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-xl border border-line bg-surface p-6">
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {translate(locale, "newsletter.label")}
        </p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          {translate(locale, "newsletter.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{translate(locale, "newsletter.body")}</p>

        {status === "sent" ? (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {translate(locale, "newsletter.checkInbox")}
          </p>
        ) : null}
        {status === "already" ? (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {translate(locale, "newsletter.already")}
          </p>
        ) : null}
        {confirmed === "1" ? (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {translate(locale, "newsletter.confirmed")}
          </p>
        ) : null}
        {confirmed === "0" ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {translate(locale, "newsletter.invalid")}
          </p>
        ) : null}
        {unsubscribed === "1" ? (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {translate(locale, "newsletter.unsubscribed")}
          </p>
        ) : null}
        {unsubscribed === "0" ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {translate(locale, "newsletter.unsubscribeInvalid")}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <form action={subscribeNewsletterAction} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="newsletter-name">{translate(locale, "newsletter.name")}</Label>
            <Input id="newsletter-name" name="name" autoComplete="name" maxLength={120} />
          </div>
          <div>
            <Label htmlFor="newsletter-email">{translate(locale, "newsletter.email")}</Label>
            <Input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
            />
          </div>
          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" name="consent" required className="mt-0.5 size-4" />
            {translate(locale, "newsletter.consent")}
          </label>
          <Button type="submit" className="w-full">
            {translate(locale, "newsletter.submit")}
          </Button>
        </form>

        <p className="mt-4 text-xs text-muted">
          {translate(locale, "newsletter.manage")}{" "}
          <Link
            href={localePath(locale, "/account")}
            className="underline underline-offset-4 hover:text-ink"
          >
            {translate(locale, "newsletter.manageLink")}
          </Link>{" "}
          {translate(locale, "newsletter.manageSuffix")}
        </p>
      </div>

      <Link
        href={localePath(locale, "/")}
        className="mt-6 text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        {translate(locale, "auth.continueShopping")}
      </Link>
    </div>
  );
}
