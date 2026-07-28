import React from "react";
import type { HomeProjectFilter, HomeProjectSort } from "../../features/home/project-view-model";
import type { TranslationKey } from "../../i18n";

export type HomeProjectFiltersProps = {
  filter: HomeProjectFilter;
  onFilterChange: (filter: HomeProjectFilter) => void;
  sort: HomeProjectSort;
  onSortChange: (sort: HomeProjectSort) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
};

const FILTERS: HomeProjectFilter[] = ["all", "general", "adult"];

export function HomeProjectFilters({
  filter,
  onFilterChange,
  sort,
  onSortChange,
  t,
}: HomeProjectFiltersProps) {
  const filterLabel = (value: HomeProjectFilter) =>
    value === "all"
      ? t("home.filterAll")
      : value === "general"
        ? t("home.filterGeneral")
        : t("home.filterAdult");
  return (
    <div
      className="home-project-filters"
      role="group"
      aria-label={t("home.filterLabel")}
    >
      <div className="home-project-filter-chips">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className={
              value === filter
                ? "home-filter-chip home-filter-chip-active"
                : "home-filter-chip"
            }
            aria-pressed={value === filter}
            onClick={() => onFilterChange(value)}
          >
            {filterLabel(value)}
          </button>
        ))}
      </div>
      <label className="home-project-sort">
        <span>{t("home.sortLabel")}</span>
        <select
          value={sort}
          onChange={(event) =>
            onSortChange(event.target.value === "title" ? "title" : "recent")
          }
        >
          <option value="recent">{t("home.sortRecent")}</option>
          <option value="title">{t("home.sortTitle")}</option>
        </select>
      </label>
    </div>
  );
}
