import React from "react";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";
export type StatusActivity = "running";

export function StatusBadge({
  children,
  tone = "neutral",
  live = false,
  activity,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  live?: boolean;
  activity?: StatusActivity;
}) {
  const classes = [
    "status-badge",
    `status-badge-${tone}`,
    activity ? `status-badge-activity-${activity}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span
      className={classes}
      role="status"
      aria-live={live ? "polite" : "off"}
    >
      <span className="status-badge-dot" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
