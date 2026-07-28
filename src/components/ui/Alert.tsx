import type { ReactNode } from "react";
import clsx from "clsx";

export type AlertTone = "info" | "success" | "warning" | "danger";

const toneClasses: Record<AlertTone, string> = {
  info: "ui-alert-info",
  success: "ui-alert-success",
  warning: "ui-alert-warning",
  danger: "ui-alert-danger",
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const urgent = tone === "danger";
  return (
    <div
      className={clsx("ui-alert", toneClasses[tone], className)}
      role={urgent ? "alert" : "status"}
    >
      {title ? <p className="font-bold">{title}</p> : null}
      <div className={clsx(title && "mt-1")}>{children}</div>
    </div>
  );
}
export function FlashMessage({
  message,
  error,
  className,
}: {
  message?: string;
  error?: string;
  className?: string;
}) {
  if (!message && !error) return null;
  return (
    <div className={clsx("space-y-3", className)}>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
