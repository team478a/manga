import type { ReactNode } from "react";
import clsx from "clsx";

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        "flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-leaf">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={clsx("text-3xl font-bold tracking-tight", eyebrow && "mt-2")}>
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-text-secondary sm:text-lg">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
