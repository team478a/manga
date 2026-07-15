import React from "react";
import type { Episode, Page, ProjectBundle } from "@mangai/project-core";
import { episodeTemplates, type EpisodeTemplateId } from "@mangai/canvas-core";
import { useI18n } from "../../i18n";

export function ProjectStructureTab({
  bundle,
  episode,
  pages,
  selectedPageId,
  assetUrls,
  episodeTemplateId,
  apply,
  onSelectEpisode,
  onSelectPage,
  onEpisodeTemplateChange,
}: {
  bundle: ProjectBundle;
  episode?: Episode;
  pages: Page[];
  selectedPageId: string | null;
  assetUrls: Record<string, string>;
  episodeTemplateId: EpisodeTemplateId;
  apply: (promise: Promise<ProjectBundle>) => void;
  onSelectEpisode: (id: string) => void;
  onSelectPage: (id: string | null) => void;
  onEpisodeTemplateChange: (id: EpisodeTemplateId) => void;
}) {
  const { t } = useI18n();
  const templateText = (id: EpisodeTemplateId) =>
    id === "short_8"
      ? {
          name: t("template.short8.name"),
          description: t("template.short8.description"),
        }
      : id === "standard_16"
        ? {
            name: t("template.standard16.name"),
            description: t("template.standard16.description"),
          }
        : {
            name: t("template.fourPanel8.name"),
            description: t("template.fourPanel8.description"),
          };
  return (
    <>
      <section>
        <h3>{t("structure.project")}</h3>
        <button className="row active" title={bundle.project.title}>
          {bundle.project.title}
        </button>
      </section>
      <section>
        <h3>
          {t("structure.episodes")}
          <button
            title={t("structure.addEpisode")}
            aria-label={t("structure.addEpisode")}
            onClick={() => {
              const title = prompt(
                t("structure.episodeName"),
                t("structure.newEpisode"),
              );
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
              className={"row " + (item.id === episode?.id ? "active" : "")}
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
              title={t("structure.rename")}
              aria-label={`${t("structure.rename")}: ${item.title}`}
              onClick={() => {
                const title = prompt(t("structure.episodeName"), item.title);
                if (title) apply(window.mangai.renameEpisode(item.id, title));
              }}
            >
              ✎
            </button>
            <button
              disabled={index === 0}
              title={t("structure.moveUp")}
              aria-label={`${t("structure.moveUp")}: ${item.title}`}
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
              title={t("structure.moveDown")}
              aria-label={`${t("structure.moveDown")}: ${item.title}`}
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
              title={t("structure.delete")}
              aria-label={`${t("structure.delete")}: ${item.title}`}
              onClick={() =>
                confirm(
                  t("structure.deleteEpisodeConfirm", { title: item.title }),
                ) && apply(window.mangai.deleteEpisode(item.id))
              }
            >
              ×
            </button>
          </div>
        ))}
        {episode && (
          <div className="episode-template">
            <select
              aria-label={t("structure.episodeTemplate")}
              value={episodeTemplateId}
              onChange={(event) =>
                onEpisodeTemplateChange(event.target.value as EpisodeTemplateId)
              }
            >
              {episodeTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {templateText(template.id).name}
                </option>
              ))}
            </select>
            <button
              title={t("structure.applyTemplateTitle")}
              onClick={() => {
                const template = episodeTemplates.find(
                  (item) => item.id === episodeTemplateId,
                );
                if (
                  template &&
                  confirm(
                    t("structure.applyTemplateConfirm", {
                      title: episode.title,
                      name: templateText(template.id).name,
                      description: templateText(template.id).description,
                    }),
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
              {t("structure.applyStory")}
            </button>
          </div>
        )}
      </section>
      <section className="grow">
        <h3>
          {t("structure.pages")}
          <button
            title={t("structure.addPage")}
            aria-label={t("structure.addPage")}
            onClick={() => episode && apply(window.mangai.addPage(episode.id))}
          >
            ＋
          </button>
        </h3>
        {pages.length ? (
          pages.map((page, index) => (
            <div
              className={
                "page-row " + (page.id === selectedPageId ? "active" : "")
              }
              key={page.id}
            >
              <button
                className="page-select"
                aria-label={`Page ${page.pageNumber}`}
                onClick={() => onSelectPage(page.id)}
              >
                <span>
                  {assetUrls[page.imageAssetId || ""] ? (
                    <img src={assetUrls[page.imageAssetId || ""]} alt="" />
                  ) : (
                    "□"
                  )}
                </span>
                <b>{page.pageNumber}</b>
              </button>
              <button
                disabled={index === 0}
                title={t("structure.movePageUp", { page: page.pageNumber })}
                aria-label={t("structure.movePageUp", {
                  page: page.pageNumber,
                })}
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
                title={t("structure.movePageDown", { page: page.pageNumber })}
                aria-label={t("structure.movePageDown", {
                  page: page.pageNumber,
                })}
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
          ))
        ) : (
          <div className="panel-empty">{t("structure.noPages")}</div>
        )}
      </section>
    </>
  );
}
