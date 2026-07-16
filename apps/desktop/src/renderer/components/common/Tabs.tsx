import React from "react";

export type TabOption<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function Tabs<T extends string>({
  label,
  idPrefix,
  value,
  options,
  onChange,
}: {
  label: string;
  idPrefix: string;
  value: T;
  options: Array<TabOption<T>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.id}
          id={`${idPrefix}-tab-${option.id}`}
          role="tab"
          type="button"
          aria-label={
            option.count === undefined
              ? option.label
              : `${option.label} (${option.count})`
          }
          aria-selected={value === option.id}
          aria-controls={`${idPrefix}-panel-${option.id}`}
          tabIndex={value === option.id ? 0 : -1}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => {
            const last = options.length - 1;
            const nextIndex =
              event.key === "ArrowRight"
                ? index === last
                  ? 0
                  : index + 1
                : event.key === "ArrowLeft"
                  ? index === 0
                    ? last
                    : index - 1
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? last
                      : null;
            if (nextIndex === null) return;
            event.preventDefault();
            const next = options[nextIndex];
            onChange(next.id);
            document.getElementById(`${idPrefix}-tab-${next.id}`)?.focus();
          }}
        >
          <span>{option.label}</span>
          {option.count !== undefined && (
            <small aria-hidden="true">{option.count}</small>
          )}
        </button>
      ))}
    </div>
  );
}
