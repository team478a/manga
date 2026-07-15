import React from "react";
import type { Asset, Page, ProjectBundle } from "@mangai/project-core";
import { CreatorChat } from "../../features/creator-chat/CreatorChat";
import { Tabs } from "../common/Tabs";
import { useI18n } from "../../i18n";

export type InspectorTab = "properties" | "layers" | "ai";

export function InspectorPanel({
  bundle,
  page,
  asset,
  assetUrl,
  episodeId,
  activeTab,
  onTabChange,
  onPropertiesHost,
  onLayersHost,
  onBundle,
  onOpenSettings,
  apply,
  saving,
}: {
  bundle: ProjectBundle;
  page?: Page;
  asset?: Asset;
  assetUrl?: string;
  episodeId?: string;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onPropertiesHost: (element: HTMLDivElement | null) => void;
  onLayersHost: (element: HTMLDivElement | null) => void;
  onBundle: (value: ProjectBundle) => void;
  onOpenSettings: () => void;
  apply: (promise: Promise<ProjectBundle>) => void;
  saving: (status: string) => void;
}) {
  const { t } = useI18n();
  const [promptText, setPrompt] = React.useState(page?.prompt || ""),
    [negative, setNegative] = React.useState(page?.negativePrompt || ""),
    [notes, setNotes] = React.useState(page?.notes || "");

  React.useEffect(() => {
    setPrompt(page?.prompt || "");
    setNegative(page?.negativePrompt || "");
    setNotes(page?.notes || "");
  }, [page?.id]);

  React.useEffect(() => {
    if (!page) return;
    const timer = setTimeout(() => {
      saving(t("saving.inProgress"));
      apply(window.mangai.savePage(page.id, promptText, negative, notes));
    }, 700);
    return () => clearTimeout(timer);
  }, [promptText, negative, notes]);

  return (
    <aside
      id="inspector-panel"
      className="right inspector-panel"
      aria-label={t("inspector.aria")}
    >
      <div className="inspector-tabs">
        <Tabs
          label={t("inspector.aria")}
          idPrefix="inspector"
          value={activeTab}
          options={[
            { id: "properties", label: t("inspector.properties") },
            { id: "layers", label: t("inspector.layers") },
            { id: "ai", label: "AI" },
          ]}
          onChange={onTabChange}
        />
      </div>
      <div
        id="inspector-panel-properties"
        className="inspector-tab-panel"
        role="tabpanel"
        aria-labelledby="inspector-tab-properties"
        hidden={activeTab !== "properties"}
      >
        <div ref={onPropertiesHost} className="canvas-properties-host" />
        <section>
          <h3>{t("inspector.projectInfo")}</h3>
          <label>
            {t("inspector.title")}
            <input
              defaultValue={bundle.project.title}
              onBlur={(event) => {
                if (event.target.value !== bundle.project.title)
                  apply(
                    window.mangai.renameProject(
                      bundle.project.id,
                      event.target.value,
                    ),
                  );
              }}
            />
          </label>
          <p>
            {bundle.project.width} × {bundle.project.height}px /{" "}
            {bundle.project.dpi}dpi
          </p>
          <p>
            {bundle.project.readingDirection === "rtl"
              ? t("projectDialog.rtl")
              : t("projectDialog.ltr")}
            ・
            {bundle.project.ageRating === "全年齢"
              ? t("projectDialog.allAges")
              : bundle.project.ageRating === "12歳以上"
                ? t("projectDialog.age12")
                : bundle.project.ageRating === "15歳以上"
                  ? t("projectDialog.age15")
                  : t("projectDialog.adult")}
          </p>
        </section>
        {page && (
          <section>
            <h3>{t("inspector.pageInfo")}</h3>
            <p>
              {t("inspector.pageSummary", {
                page: page.pageNumber,
                width: page.width,
                height: page.height,
              })}
            </p>
            <div className="inline">
              <button
                onClick={() => apply(window.mangai.duplicatePage(page.id))}
              >
                {t("inspector.duplicate")}
              </button>
              <button
                className="danger"
                onClick={() =>
                  confirm(t("inspector.deletePageConfirm")) &&
                  apply(window.mangai.deletePage(page.id))
                }
              >
                {t("inspector.delete")}
              </button>
            </div>
            <label>
              {t("inspector.prompt")}
              <textarea
                value={promptText}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            <label>
              {t("inspector.negativePrompt")}
              <textarea
                value={negative}
                onChange={(event) => setNegative(event.target.value)}
              />
            </label>
            <label>
              {t("inspector.notes")}
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </section>
        )}
        {asset && (
          <section>
            <h3>{t("inspector.selectedImage")}</h3>
            <img className="preview" src={assetUrl} alt={asset.fileName} />
            <p title={asset.fileName}>{asset.fileName}</p>
            <p>
              {asset.width} × {asset.height}px
            </p>
            <p>{Math.round(asset.byteSize / 1024)} KB</p>
            <div className="inline">
              {!page && (
                <button
                  onClick={() =>
                    episodeId &&
                    apply(window.mangai.addPage(episodeId, asset.id))
                  }
                >
                  {t("inspector.addToPage")}
                </button>
              )}
              <button
                className="secondary"
                onClick={() =>
                  apply(
                    window.mangai.setProjectCover(bundle.project.id, asset.id),
                  )
                }
              >
                {t("inspector.setCover")}
              </button>
              <button
                className="danger"
                onClick={() =>
                  confirm(t("inspector.deleteAssetConfirm")) &&
                  apply(window.mangai.deleteAsset(asset.id))
                }
              >
                {t("inspector.deleteAsset")}
              </button>
            </div>
          </section>
        )}
      </div>
      <div
        id="inspector-panel-layers"
        className="inspector-tab-panel inspector-layers-panel"
        role="tabpanel"
        aria-labelledby="inspector-tab-layers"
        hidden={activeTab !== "layers"}
      >
        <div ref={onLayersHost} />
      </div>
      <div
        id="inspector-panel-ai"
        className="inspector-tab-panel inspector-ai-panel"
        role="tabpanel"
        aria-labelledby="inspector-tab-ai"
        hidden={activeTab !== "ai"}
      >
        <CreatorChat
          variant="panel"
          bundle={bundle}
          episodeId={episodeId}
          pageId={page?.id}
          onBundle={onBundle}
          onOpenSettings={onOpenSettings}
          onClose={() => onTabChange("properties")}
        />
      </div>
    </aside>
  );
}
