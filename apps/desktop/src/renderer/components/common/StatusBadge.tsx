import React from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export function StatusBadge({
  children,
  tone = "neutral",
  live = false,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  live?: boolean;
}) {
  return (
    <span
      className={`status-badge status-badge-${tone}`}
      role="status"
      aria-live={live ? "polite" : "off"}
    >
      <span className="status-badge-dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
