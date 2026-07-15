import React from "react";
import type { Asset, Page, ProjectBundle } from "@mangai/project-core";
import { CreatorChat } from "../../features/creator-chat/CreatorChat";
import { Tabs } from "../common/Tabs";

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
      saving("保存中…");
      apply(window.mangai.savePage(page.id, promptText, negative, notes));
    }, 700);
    return () => clearTimeout(timer);
  }, [promptText, negative, notes]);

  return (
    <aside
      id="inspector-panel"
      className="right inspector-panel"
      aria-label="編集パネル"
    >
      <div className="inspector-tabs">
        <Tabs
          label="編集パネル"
          idPrefix="inspector"
          value={activeTab}
          options={[
            { id: "properties", label: "プロパティ" },
            { id: "layers", label: "レイヤー" },
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
          <h3>プロジェクト情報</h3>
          <label>
            タイトル
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
            {bundle.project.readingDirection === "rtl" ? "右開き" : "左開き"}・
            {bundle.project.ageRating}
          </p>
        </section>
        {page && (
          <section>
            <h3>ページ情報</h3>
            <p>
              ページ {page.pageNumber} / {page.width} × {page.height}
            </p>
            <div className="inline">
              <button
                onClick={() => apply(window.mangai.duplicatePage(page.id))}
              >
                複製
              </button>
              <button
                className="danger"
                onClick={() =>
                  confirm("ページを削除しますか？") &&
                  apply(window.mangai.deletePage(page.id))
                }
              >
                削除
              </button>
            </div>
            <label>
              プロンプト
              <textarea
                value={promptText}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>
            <label>
              ネガティブプロンプト
              <textarea
                value={negative}
                onChange={(event) => setNegative(event.target.value)}
              />
            </label>
            <label>
              メモ
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </section>
        )}
        {asset && (
          <section>
            <h3>選択画像</h3>
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
                  ページへ追加
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
                代表画像に設定
              </button>
              <button
                className="danger"
                onClick={() =>
                  confirm("素材をゴミ箱へ移動しますか？") &&
                  apply(window.mangai.deleteAsset(asset.id))
                }
              >
                素材削除
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
