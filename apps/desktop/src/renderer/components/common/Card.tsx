import React from "react";

export type CardVariant = "static" | "interactive";
export type CardDensity = "standard" | "compact";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  density?: CardDensity;
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      variant = "static",
      density = "standard",
      className,
      onClick,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const classes = [
      "ds-card",
      `ds-card-${variant}`,
      `ds-card-density-${density}`,
      className,
    ]
      .filter(Boolean)
      .join(" ");
    const interactive = variant === "interactive" && Boolean(onClick);
    return (
      <div
        ref={ref}
        className={classes}
        role={interactive ? "button" : rest.role}
        tabIndex={interactive ? 0 : rest.tabIndex}
        onClick={onClick}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!interactive || event.defaultPrevented) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.currentTarget.click();
          }
        }}
        {...rest}
      />
    );
  },
);
