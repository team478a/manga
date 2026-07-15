import React from "react";
import type { Episode, ProjectBundle } from "@mangai/project-core";
import { Search, Upload } from "lucide-react";

type AssetFilter = "all" | "png" | "jpeg" | "webp";

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
  const [query, setQuery] = React.useState(""),
    [filter, setFilter] = React.useState<AssetFilter>("all");

  const usedAssetIds = React.useMemo(() => {
    const ids = new Set<string>();
    if (bundle.project.coverAssetId) ids.add(bundle.project.coverAssetId);
    bundle.pages.forEach((page) => {
      if (page.imageAssetId) ids.add(page.imageAssetId);
    });
    bundle.panels.forEach((panel) => {
      if (panel.imageAssetId) ids.add(panel.imageAssetId);
    });
    return ids;
  }, [bundle.project.coverAssetId, bundle.pages, bundle.panels]);

  const assets = React.useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
    return bundle.assets.filter((asset) => {
      const matchesQuery =
        !normalizedQuery ||
        asset.fileName.toLocaleLowerCase("ja-JP").includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "png" && asset.mimeType === "image/png") ||
        (filter === "jpeg" && asset.mimeType === "image/jpeg") ||
        (filter === "webp" && asset.mimeType === "image/webp");
      return matchesQuery && matchesFilter;
    });
  }, [bundle.assets, filter, query]);

  return (
    <>
      <section className="asset-browser-toolbar">
        <button
          className="asset-import-button"
          onClick={() => apply(window.mangai.pickAssets(bundle.project.id))}
        >
          <Upload size={16} aria-hidden="true" />
          素材を追加
        </button>
        <label className="asset-search">
          <Search size={15} aria-hidden="true" />
          <input
            value={query}
            placeholder="素材名を検索"
            aria-label="素材名を検索"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="素材形式"
          value={filter}
          onChange={(event) => setFilter(event.target.value as AssetFilter)}
        >
          <option value="all">すべての形式</option>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
        </select>
      </section>
      <section className="assets">
        <div className="asset-browser-heading">
          <h3>素材</h3>
          <small>
            {assets.length} / {bundle.assets.length}件
          </small>
        </div>
        {assets.length ? (
          <div className="asset-grid">
            {assets.map((asset) => {
              const inUse = usedAssetIds.has(asset.id);
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
                    {inUse && <span className="asset-usage">使用中</span>}
                  </span>
                  <small>{asset.fileName}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="panel-empty">
            {bundle.assets.length
              ? "条件に一致する素材はありません。"
              : "素材を追加するとここに表示されます。"}
          </div>
        )}
        {episode && bundle.assets.length > 0 && (
          <button
            className="wide secondary"
            onClick={async () => {
              let nextBundle = bundle;
              for (const asset of bundle.assets)
                nextBundle = await window.mangai.addPage(episode.id, asset.id);
              onBundle(nextBundle);
              onSelectPage(nextBundle.pages.at(-1)?.id || null);
            }}
          >
            全素材を連続Page化
          </button>
        )}
      </section>
    </>
  );
}
