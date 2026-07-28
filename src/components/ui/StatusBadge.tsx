import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "ui-status-neutral",
  info: "ui-status-info",
  success: "ui-status-success",
  warning: "ui-status-warning",
  danger: "ui-status-danger",
};

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={clsx("ui-status", toneClasses[tone], className)}
      {...props}
    />
  );
}
