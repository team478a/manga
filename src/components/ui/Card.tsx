import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type CardVariant = "default" | "interactive" | "muted";

const variantClasses: Record<CardVariant, string> = {
  default: "ui-card-default",
  interactive: "ui-card-interactive",
  muted: "ui-card-muted",
};

export function Card({
  variant = "default",
  className,
  ...props
}: HTMLAttributes<HTMLElement> & { variant?: CardVariant }) {
  return (
    <section
      className={clsx("ui-card", variantClasses[variant], className)}
      {...props}
    />
  );
}
