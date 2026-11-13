"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { PromotionSlide } from "@/server/services/promotions";

const INTERVAL_MS = 6_000;

export function PromotionCarousel({ promotions }: { promotions: PromotionSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || promotions.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % promotions.length);
    }, INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [paused, promotions.length, index]);

  if (promotions.length === 0) return null;

  const current = promotions[Math.min(index, promotions.length - 1)];
  if (!current) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotions"
      className="relative overflow-hidden rounded-2xl border border-line bg-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link href={current.href} className="block">
        <div className="relative aspect-[16/6] min-h-[220px] w-full">
          <Image
            src={`/media/${current.imageKey}`}
            alt={current.imageAlt || current.headline || "Promotion"}
            fill
            priority={index === 0}
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/5" />

          <div className="absolute inset-0 flex flex-col justify-end gap-2 p-6 sm:p-10">
            {current.headline ? (
              <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-white text-balance sm:text-3xl">
                {current.headline}
              </h2>
            ) : null}
            {current.subheadline ? (
              <p className="max-w-xl text-sm text-white/80">{current.subheadline}</p>
            ) : null}
            <span className="mt-2 inline-flex w-fit rounded-lg bg-white px-4 py-2 text-sm font-medium text-ink">
              {current.ctaLabel}
            </span>
          </div>
        </div>
      </Link>

      {promotions.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() =>
              setIndex((current) => (current - 1 + promotions.length) % promotions.length)
            }
            className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur hover:bg-black/60"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => setIndex((current) => (current + 1) % promotions.length)}
            className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white backdrop-blur hover:bg-black/60"
          >
            ›
          </button>

          <div className="absolute bottom-4 right-4 flex gap-1.5">
            {promotions.map((promotion, slideIndex) => (
              <button
                key={promotion.id}
                type="button"
                aria-label={`Show slide ${slideIndex + 1}`}
                aria-pressed={slideIndex === index}
                onClick={() => setIndex(slideIndex)}
                className={`h-2 rounded-full transition-all ${
                  slideIndex === index ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
