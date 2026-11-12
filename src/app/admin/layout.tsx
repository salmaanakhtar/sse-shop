import type { ReactNode } from "react";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-page text-ink">{children}</div>;
}
