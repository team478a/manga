import type { HTMLAttributes, ReactNode } from "react";

export function StatusBadge({
  children,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLSpanElement>, "children" | "className"> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      {...props}
      className={`rounded-full bg-linen px-3 py-1 ${className}`.trim()}
    >
      {children}
    </span>
  );
}
