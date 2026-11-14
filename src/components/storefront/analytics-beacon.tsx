"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Sends one page-view beacon per route. The server derives product views and
 * hashes the visitor; nothing is stored in the browser.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;

    const body = JSON.stringify({ path: pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/view", body);
      return;
    }

    void fetch("/api/analytics/view", {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "text/plain" },
    });
  }, [pathname]);

  return null;
}
