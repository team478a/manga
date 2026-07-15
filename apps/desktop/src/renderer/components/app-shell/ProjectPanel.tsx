import React from "react";
import type { Episode, Page, ProjectBundle } from "@mangai/project-core";
import { episodeTemplates, type EpisodeTemplateId } from "@mangai/canvas-core";

export function ProjectPanel({
  bundle,
  episode,
  pages,
  selectedPageId,
  selectedAssetId,
  assetUrls,
  episodeTemplateId,
  apply,
  onBundle,
  onSelectEpisode,
  onSelectPage,
  onSelectAsset,
  onEpisodeTemplateChange,
}: {
  bundle: ProjectBundle;
  episode?: Episode;
  pages: Page[];
  selectedPageId: string | null;
  selectedAssetId: string | null;
  assetUrls: Record<string, string>;
  episodeTemplateId: EpisodeTemplateId;
  apply: (promise: Promise<ProjectBundle>) => void;
  onBundle: (bundle: ProjectBundle) => void;
  onSelectEpisode: (id: string) => void;
  onSelectPage: (id: string | null) => void;
  onSelectAsset: (id: string) => void;
  onEpisodeTemplateChange: (id: EpisodeTemplateId) => void;
}) {
  return (
    <aside className="left project-panel" aria-label="Project構成と素材">
      <section>
        <h3>プロジェクト</h3>
        <button className="row active" title={bundle.project.title}>
          {bundle.project.title}
        </button>
      </section>
      <section>
        <h3>
          エピソード
          <button
            title="Episodeを追加"
            aria-label="Episodeを追加"
            onClick={() => {
              const title = prompt("エピソード名", "新しいエピソード");
              if (title)
                void apply(
                  window.mangai.createEpisode(bundle.project.id, title),
                );
            }}
          >
            ＋
          </button>
        </h3>
        {bundle.episodes.map((item, index) => (
          <div className="episode-row" key={item.id}>
            <button
              className={`row ${item.id === episode?.id ? "active" : ""}`}
              onClick={() => {
                onSelectEpisode(item.id);
                const firstPage = bundle.pages
                  .filter((page) => page.episodeId === item.id)
                  .sort((a, b) => a.orderIndex - b.orderIndex)[0];
                onSelectPage(firstPage?.id ?? null);
              }}
            >
              {item.title}
            </button>
            <button
              title="名前変更"
              onClick={() => {
                const title = prompt("エピソード名", item.title);
                if (title) apply(window.mangai.renameEpisode(item.id, title));
              }}
            >
              ✎
            </button>
            <button
              disabled={index === 0}
              title="上へ"
              onClick={() => {
                const ids = bundle.episodes.map((episode) => episode.id);
                [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                apply(window.mangai.reorderEpisodes(bundle.project.id, ids));
              }}
            >
              ↑
            </button>
            <button
              disabled={index === bundle.episodes.length - 1}
              title="下へ"
              onClick={() => {
                const ids = bundle.episodes.map((episode) => episode.id);
                [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                apply(window.mangai.reorderEpisodes(bundle.project.id, ids));
              }}
            >
              ↓
            </button>
            <button
              className="danger"
              disabled={bundle.episodes.length <= 1}
              title="削除"
              onClick={() =>
                confirm(`「${item.title}」とページを削除しますか？`) &&
                apply(window.mangai.deleteEpisode(item.id))
              }
            >
              ×
            </button>
          </div>
        ))}
        {episode && (
          <div className="episode-template">
            <select
              aria-label="話テンプレート"
              value={episodeTemplateId}
              onChange={(event) =>
                onEpisodeTemplateChange(event.target.value as EpisodeTemplateId)
              }
            >
              {episodeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              title="選択中のEpisode末尾へページとコマを一括追加"
              onClick={() => {
                const template = episodeTemplates.find(
                  (item) => item.id === episodeTemplateId,
                );
                if (
                  template &&
                  confirm(
                    `「${episode.title}」の末尾へ${template.name}を追加しますか？\n${template.description}\nこの操作は1回のUndoで戻せます。`,
                  )
                )
                  void apply(
                    window.mangai.applyEpisodeTemplate(
                      episode.id,
                      episodeTemplateId,
                    ),
                  );
              }}
            >
              話構成を追加
            </button>
          </div>
        )}
      </section>
      <section className="grow">
        <h3>
          ページ
          <button
            title="Pageを追加"
            aria-label="Pageを追加"
            onClick={() => episode && apply(window.mangai.addPage(episode.id))}
          >
            ＋
          </button>
        </h3>
        {pages.map((page, index) => (
          <div
            className={`page-row ${page.id === selectedPageId ? "active" : ""}`}
            key={page.id}
            onClick={() => onSelectPage(page.id)}
          >
            <span>
              {assetUrls[page.imageAssetId || ""] ? (
                <img
                  src={assetUrls[page.imageAssetId || ""]}
                  alt={`Page ${page.pageNumber}`}
                />
              ) : (
                "□"
              )}
            </span>
            <b>{page.pageNumber}</b>
            <button
              disabled={index === 0}
              title="Pageを上へ"
              aria-label={`Page ${page.pageNumber}を上へ`}
              onClick={(event) => {
                event.stopPropagation();
                const ids = pages.map((item) => item.id);
                [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
                if (episode)
                  void apply(window.mangai.reorderPages(episode.id, ids));
              }}
            >
              ↑
            </button>
            <button
              disabled={index === pages.length - 1}
              title="Pageを下へ"
              aria-label={`Page ${page.pageNumber}を下へ`}
              onClick={(event) => {
                event.stopPropagation();
                const ids = pages.map((item) => item.id);
                [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
                if (episode)
                  void apply(window.mangai.reorderPages(episode.id, ids));
              }}
            >
              ↓
            </button>
          </div>
        ))}
      </section>
      <section className="assets">
        <h3>素材 ({bundle.assets.length})</h3>
        <div className="asset-grid">
          {bundle.assets.map((asset) => (
            <button
              key={asset.id}
              title={asset.fileName}
              draggable
              className={asset.id === selectedAssetId ? "active" : ""}
              onClick={() => onSelectAsset(asset.id)}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "copy";
                event.dataTransfer.setData(
                  "application/x-mangai-asset-id",
                  asset.id,
                );
              }}
            >
              <img src={assetUrls[asset.id]} alt="" />
              <small>{asset.fileName}</small>
            </button>
          ))}
        </div>
        {episode && bundle.assets.length > 0 && (
          <button
            className="wide"
            onClick={async () => {
              let nextBundle = bundle;
              for (const asset of bundle.assets)
                nextBundle = await window.mangai.addPage(episode.id, asset.id);
              onBundle(nextBundle);
              onSelectPage(nextBundle.pages.at(-1)?.id || null);
            }}
          >
            全素材を連続ページ化
          </button>
        )}
      </section>
    </aside>
  );
}
