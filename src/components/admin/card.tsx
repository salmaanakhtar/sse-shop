import type { ReactNode } from "react";

export function AdminCard({ children }: { children: ReactNode }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
      {children}
    </div>
  );
}
