import React, { useEffect, useId, useMemo, useRef, useState } from "react";

export type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  onSelect: () => void;
};

export type CommandSection = {
  id: string;
  label: string;
  items: CommandItem[];
};

export type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  sections: CommandSection[];
  placeholder?: string;
};

type FlatItem = { sectionId: string; item: CommandItem };

function filterSections(sections: CommandSection[], query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        item.label.toLowerCase().includes(trimmed),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function flatten(sections: CommandSection[]): FlatItem[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ sectionId: section.id, item })),
  );
}

export function CommandPalette({
  open,
  onClose,
  sections,
  placeholder = "コマンドを入力…",
}: CommandPaletteProps) {
  const idPrefix = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredSections = useMemo(
    () => filterSections(sections, query),
    [sections, query],
  );
  const flatItems = useMemo(
    () => flatten(filteredSections),
    [filteredSections],
  );

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    setQuery("");
    setActiveIndex(0);
    inputRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const moveActive = (delta: number) => {
    if (flatItems.length === 0) return;
    setActiveIndex((current) => {
      const next = (current + delta + flatItems.length) % flatItems.length;
      return next;
    });
  };

  const executeActive = () => {
    const active = flatItems[activeIndex];
    if (!active) return;
    active.item.onSelect();
    onClose();
  };

  return (
    <div
      className="ds-command-palette-scrim"
      onClick={onClose}
      data-testid="ds-command-palette-scrim"
    >
      <div
        className="ds-command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="コマンドパレット"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ds-command-palette-input-row">
          <input
            ref={inputRef}
            type="text"
            className="ds-command-palette-input"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${idPrefix}-listbox`}
            aria-activedescendant={
              flatItems[activeIndex]
                ? `${idPrefix}-option-${flatItems[activeIndex].item.id}`
                : undefined
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActive(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActive(-1);
              } else if (event.key === "Enter") {
                event.preventDefault();
                executeActive();
              } else if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
          />
        </div>
        <div
          id={`${idPrefix}-listbox`}
          role="listbox"
          aria-label="コマンド候補"
          className="ds-command-palette-results"
        >
          {filteredSections.map((section) => (
            <div key={section.id} className="ds-command-palette-section">
              <div
                className="ds-command-palette-section-label"
                aria-hidden="true"
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const flatIndex = flatItems.findIndex(
                  (flat) => flat.item.id === item.id,
                );
                const active = flatIndex === activeIndex;
                return (
                  <div
                    key={item.id}
                    id={`${idPrefix}-option-${item.id}`}
                    role="option"
                    aria-selected={active}
                    className={
                      active
                        ? "ds-command-palette-row ds-command-palette-row-active"
                        : "ds-command-palette-row"
                    }
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => {
                      item.onSelect();
                      onClose();
                    }}
                  >
                    <span className="ds-command-palette-row-label">
                      {item.label}
                    </span>
                    {item.hint && (
                      <span
                        className="ds-command-palette-row-hint"
                        aria-hidden="true"
                      >
                        {item.hint}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="ds-command-palette-live ds-visually-hidden" aria-live="polite">
          {flatItems.length}件
        </p>
      </div>
    </div>
  );
}
