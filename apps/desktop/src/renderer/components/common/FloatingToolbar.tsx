import React from "react";

export type FloatingToolbarProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
};

export function FloatingToolbar({
  label,
  className,
  children,
  ...rest
}: FloatingToolbarProps) {
  const classes = ["ds-floating-toolbar", className].filter(Boolean).join(" ");
  return (
    <div
      role="toolbar"
      aria-label={label}
      tabIndex={-1}
      className={classes}
      {...rest}
    >
      {children}
    </div>
  );
}

export function FloatingToolbarGroup({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const classes = ["ds-floating-toolbar-group", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
