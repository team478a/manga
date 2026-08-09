import type { HTMLAttributes, ReactNode } from "react";

type StateContainerProps = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className"
> & {
  children: ReactNode;
  className?: string;
};

function classNames(base: string, className: string) {
  return `${base} ${className}`.trim();
}

export function AsyncStatePage({
  children,
  className = "",
  ...props
}: StateContainerProps) {
  return (
    <main {...props} className={classNames("page", className)}>
      {children}
    </main>
  );
}

export function AsyncStatePanel({
  as = "section",
  children,
  className = "",
  ...props
}: StateContainerProps & { as?: "div" | "section" }) {
  const Component = as;
  return (
    <Component {...props} className={classNames("panel", className)}>
      {children}
    </Component>
  );
}

export function AsyncStateActions({
  children,
  className = "",
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children" | "className"> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div {...props} className={classNames("flex", className)}>
      {children}
    </div>
  );
}
