import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDateFor, localePath, translate } from "@/lib/i18n";
import { getPageBySlug } from "@/server/services/pages";
import { getLocale, getNumeralPreference } from "@/server/services/preferences";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
  };
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) notFound();
  const [locale, numerals] = await Promise.all([getLocale(), getNumeralPreference()]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <nav aria-label="Breadcrumb" className="text-xs text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link href={localePath(locale, "/")} className="hover:text-ink">
              {translate(locale, "common.home")}
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden>/</span>
            <span className="text-ink">{page.title}</span>
          </li>
        </ol>
      </nav>

      <article className="mt-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.title}</h1>
        <p className="mt-2 text-xs text-muted">
          {formatDateFor(page.updatedAt, locale, numerals)}
        </p>
        <div
          className="prose-store mt-8 space-y-4 text-sm leading-relaxed text-muted [&_a]:text-brand [&_a]:underline [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink"
          dangerouslySetInnerHTML={{ __html: page.body }}
        />
      </article>
    </div>
  );
}
