import React from "react";
import {
  isInternalPanelCacheAsset,
  type Episode,
  type ProjectBundle,
} from "@mangai/project-core";
import type { AssetLibraryCategory } from "@mangai/shared";
import { Search, Star, Upload } from "lucide-react";
import { useI18n } from "../../i18n";

type AssetFilter = "all" | "png" | "jpeg" | "webp";
type CategoryFilter = "all" | AssetLibraryCategory;

const categories: AssetLibraryCategory[] = [
  "unclassified",
  "background",
  "prop",
  "effect",
  "character",
  "other",
];

function categoryKey(category: AssetLibraryCategory) {
  return `asset.category.${category}` as const;
}

export function AssetBrowser({
  bundle,
  episode,
  selectedAssetId,
  assetUrls,
  apply,
  onBundle,
  onSelectPage,
  onSelectAsset,
}: {
  bundle: ProjectBundle;
  episode?: Episode;
  selectedAssetId: string | null;
  assetUrls: Record<string, string>;
  apply: (promise: Promise<ProjectBundle>) => void;
  onBundle: (bundle: ProjectBundle) => void;
  onSelectPage: (id: string | null) => void;
  onSelectAsset: (id: string) => void;
}) {
  const { localeCode, t } = useI18n();
  const [query, setQuery] = React.useState(""),
    [filter, setFilter] = React.useState<AssetFilter>("all"),
    [categoryFilter, setCategoryFilter] = React.useState<CategoryFilter>("all"),
    [favoritesOnly, setFavoritesOnly] = React.useState(false),
    [editCategory, setEditCategory] =
      React.useState<AssetLibraryCategory>("unclassified"),
    [editTags, setEditTags] = React.useState(""),
    [editFavorite, setEditFavorite] = React.useState(false);
  const libraryAssets = React.useMemo(
    () => bundle.assets.filter((asset) => !isInternalPanelCacheAsset(asset)),
    [bundle.assets],
  );

  const selectedAsset = libraryAssets.find(
    (asset) => asset.id === selectedAssetId,
  );
  React.useEffect(() => {
    setEditCategory(selectedAsset?.libraryCategory ?? "unclassified");
    setEditTags(selectedAsset?.libraryTags.join(", ") ?? "");
    setEditFavorite(selectedAsset?.libraryFavorite ?? false);
  }, [selectedAsset]);

  const assetUsageCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    const add = (id: string | null) => {
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    };
    add(bundle.project.coverAssetId);
    bundle.pages.forEach((page) => {
      add(page.imageAssetId);
    });
    bundle.panels.forEach((panel) => {
      add(panel.imageAssetId);
    });
    const legacyPanelAssets = new Map(
      bundle.panels.map((panel) => [panel.id, panel.imageAssetId]),
    );
    bundle.panelLayers.forEach((layer) => {
      if (
        layer.type !== "flattened_legacy" ||
        legacyPanelAssets.get(layer.panelId) !== layer.assetId
      )
        add(layer.assetId);
    });
    return counts;
  }, [
    bundle.project.coverAssetId,
    bundle.pages,
    bundle.panels,
    bundle.panelLayers,
  ]);

  const assets = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(localeCode);
    return libraryAssets.filter((asset) => {
      const matchesQuery =
        !normalizedQuery ||
        [asset.fileName, ...asset.libraryTags]
          .join(" ")
          .toLocaleLowerCase(localeCode)
          .includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "png" && asset.mimeType === "image/png") ||
        (filter === "jpeg" && asset.mimeType === "image/jpeg") ||
        (filter === "webp" && asset.mimeType === "image/webp");
      const matchesCategory =
        categoryFilter === "all" || asset.libraryCategory === categoryFilter;
      const matchesFavorite = !favoritesOnly || asset.libraryFavorite;
      return (
        matchesQuery && matchesFilter && matchesCategory && matchesFavorite
      );
    });
  }, [categoryFilter, favoritesOnly, filter, libraryAssets, localeCode, query]);

  return (
    <>
      <section className="asset-browser-toolbar">
        <button
          className="asset-import-button"
          onClick={() => apply(window.mangai.pickAssets(bundle.project.id))}
        >
          <Upload size={16} aria-hidden="true" />
          {t("asset.add")}
        </button>
        <label className="asset-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            placeholder={t("asset.search")}
            aria-label={t("asset.search")}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label={t("asset.format")}
          value={filter}
          onChange={(event) => setFilter(event.target.value as AssetFilter)}
        >
          <option value="all">{t("asset.allFormats")}</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
        <select
          aria-label={t("asset.category")}
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as CategoryFilter)
          }
        >
          <option value="all">{t("asset.allCategories")}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {t(categoryKey(category))}
            </option>
          ))}
        </select>
        <button
          className={favoritesOnly ? "active secondary" : "secondary"}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <Star size={15} aria-hidden="true" />
          {t("asset.favorites")}
        </button>
      </section>
      {selectedAsset && (
        <section className="asset-library-editor">
          <strong>{t("asset.libraryMetadata")}</strong>
          <select
            aria-label={t("asset.category")}
            value={editCategory}
            onChange={(event) =>
              setEditCategory(event.target.value as AssetLibraryCategory)
            }
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {t(categoryKey(category))}
              </option>
            ))}
          </select>
          <input
            value={editTags}
            maxLength={1000}
            placeholder={t("asset.tagsPlaceholder")}
            aria-label={t("asset.tags")}
            onChange={(event) => setEditTags(event.target.value)}
          />
          <label>
            <input
              type="checkbox"
              checked={editFavorite}
              onChange={(event) => setEditFavorite(event.target.checked)}
            />
            {t("asset.favorite")}
          </label>
          <button
            onClick={() =>
              apply(
                window.mangai.saveAssetLibraryMetadata({
                  assetId: selectedAsset.id,
                  category: editCategory,
                  tags: editTags
                    .split(/[,、\n]/)
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                  favorite: editFavorite,
                }),
              )
            }
          >
            {t("asset.saveMetadata")}
          </button>
        </section>
      )}
      <section className="assets">
        <div className="asset-browser-heading">
          <h3>{t("asset.heading")}</h3>
          <small>
            {t("asset.count", {
              visible: assets.length,
              total: libraryAssets.length,
            })}
          </small>
        </div>
        {assets.length ? (
          <div className="asset-grid">
            {assets.map((asset) => {
              const usageCount = assetUsageCounts.get(asset.id) ?? 0;
              const inUse = usageCount > 0;
              return (
                <button
                  key={asset.id}
                  title={asset.fileName}
                  draggable
                  className={
                    "asset-card " +
                    (asset.id === selectedAssetId ? "active " : "") +
                    (inUse ? "in-use" : "")
                  }
                  onClick={() => onSelectAsset(asset.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(
                      "application/x-mangai-asset-id",
                      asset.id,
                    );
                  }}
                >
                  <span className="asset-thumbnail">
                    <img src={assetUrls[asset.id]} alt="" />
                    {inUse && (
                      <span className="asset-usage">
                        {t("asset.usageCount", { count: usageCount })}
                      </span>
                    )}
                    {asset.libraryFavorite && (
                      <Star
                        className="asset-favorite"
                        size={15}
                        fill="currentColor"
                        aria-label={t("asset.favorite")}
                      />
                    )}
                  </span>
                  <small>{asset.fileName}</small>
                  {asset.libraryCategory !== "unclassified" && (
                    <span className="asset-category">
                      {t(categoryKey(asset.libraryCategory))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="panel-empty">
            {libraryAssets.length ? t("asset.noMatch") : t("asset.empty")}
          </div>
        )}
        {episode && libraryAssets.length > 0 && (
          <button
            className="wide secondary"
            onClick={async () => {
              let nextBundle = bundle;
              for (const asset of libraryAssets)
                nextBundle = await window.mangai.addPage(episode.id, asset.id);
              onBundle(nextBundle);
              onSelectPage(nextBundle.pages.at(-1)?.id || null);
            }}
          >
            {t("asset.makePages")}
          </button>
        )}
      </section>
    </>
  );
}
