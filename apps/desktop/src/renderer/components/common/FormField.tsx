import React, { useId } from "react";

export type FormFieldDensity = "standard" | "compact";

export type FormFieldProps = {
  label: React.ReactNode;
  children: (fieldProps: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => React.ReactNode;
  density?: FormFieldDensity;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
};

export function FormField({
  label,
  children,
  density = "standard",
  error,
  hint,
  required = false,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = `ds-form-field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const classes = [
    "ds-form-field",
    `ds-form-field-density-${density}`,
    error ? "ds-form-field-invalid" : null,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <label htmlFor={fieldId} className="ds-form-field-label">
        {label}
        {required && (
          <span className="ds-form-field-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children({
        id: fieldId,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
      })}
      {hint && !error && (
        <p id={hintId} className="ds-form-field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="ds-form-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
