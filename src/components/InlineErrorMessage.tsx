import type { HTMLAttributes, ReactNode } from "react";

export function InlineErrorMessage({
  children,
  ...props
}: Omit<HTMLAttributes<HTMLParagraphElement>, "children" | "className"> & {
  children: ReactNode;
}) {
  return (
    <p
      {...props}
      className="mt-5 rounded-md bg-red-50 p-4 text-red-700"
    >
      {children}
    </p>
  );
}
