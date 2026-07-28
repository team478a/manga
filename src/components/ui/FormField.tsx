import type { ReactNode } from "react";
import clsx from "clsx";

export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={clsx("space-y-2", className)}>
      <label className="ui-label" htmlFor={id}>
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-1 text-status-danger">
              *
            </span>
            <span className="sr-only">（必須）</span>
          </>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="text-sm text-text-muted" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-status-danger" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
