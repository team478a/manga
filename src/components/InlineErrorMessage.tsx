import type { HTMLAttributes, ReactNode } from "react";

export function InlineErrorMessage({
  children,
  radius = "md",
  ...props
}: Omit<HTMLAttributes<HTMLParagraphElement>, "children" | "className"> & {
  children: ReactNode;
  radius?: "md" | "lg";
}) {
  const radiusClass = radius === "lg" ? "rounded-lg" : "rounded-md";

  return (
    <p
      {...props}
      className={`mt-5 ${radiusClass} bg-red-50 p-4 text-red-700`}
    >
      {children}
    </p>
  );
}
