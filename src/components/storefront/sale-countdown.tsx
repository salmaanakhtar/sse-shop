"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;

  const clock = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return days > 0 ? `${days}d ${clock}` : clock;
}

export function SaleCountdown({ endsAt }: { endsAt: Date | string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState<number | null>(null);
  const refreshed = useRef(false);
  const end = new Date(endsAt).getTime();

  useEffect(() => {
    if (Number.isNaN(end)) return;

    const tick = () => {
      const left = Math.max(0, end - Date.now());
      setRemaining(left);

      if (left === 0 && !refreshed.current) {
        refreshed.current = true;
        router.refresh();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [end, router]);

  if (remaining === null || remaining <= 0) return null;

  return (
    <p data-testid="sale-timer" className="mt-1 text-xs font-medium text-brand">
      Sale ends in {formatRemaining(remaining)}
    </p>
  );
}
