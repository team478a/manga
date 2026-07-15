import React from "react";
import {
  isInternalPanelCacheAsset,
  type Episode,
  type Page,
  type ProjectBundle,
} from "@mangai/project-core";
import type { EpisodeTemplateId } from "@mangai/canvas-core";
import { AssetBrowser } from "../assets/AssetBrowser";
import { ProjectStructureTab } from "../project/ProjectStructureTab";
import { Tabs } from "../common/Tabs";
import { useI18n } from "../../i18n";

type ProjectPanelTab = "structure" | "assets";

const readPanelTab = (): ProjectPanelTab => {
  try {
    return localStorage.getItem("mangai.project-panel-tab") === "assets"
      ? "assets"
      : "structure";
  } catch {
    return "structure";
  }
};

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
  const { t } = useI18n();
  const [activeTab, setActiveTab] =
    React.useState<ProjectPanelTab>(readPanelTab);
  const assetCount = bundle.assets.filter(
    (asset) => !isInternalPanelCacheAsset(asset),
  ).length;

  React.useEffect(() => {
    try {
      localStorage.setItem("mangai.project-panel-tab", activeTab);
    } catch {
      // 保存できない環境でもタブ操作は継続する。
    }
  }, [activeTab]);

  return (
    <aside
      id="project-panel"
      className="left project-panel"
      aria-label={t("panel.projectAria")}
    >
      <div className="project-panel-tabs">
        <Tabs
          idPrefix="project-panel"
          label={t("panel.projectTabs")}
          value={activeTab}
          options={[
            {
              id: "structure",
              label: t("panel.structure"),
              count: pages.length,
            },
            {
              id: "assets",
              label: t("panel.assets"),
              count: assetCount,
            },
          ]}
          onChange={setActiveTab}
        />
      </div>

      <div
        id="project-panel-panel-structure"
        className="project-panel-view"
        role="tabpanel"
        aria-labelledby="project-panel-tab-structure"
        hidden={activeTab !== "structure"}
      >
        <ProjectStructureTab
          bundle={bundle}
          episode={episode}
          pages={pages}
          selectedPageId={selectedPageId}
          assetUrls={assetUrls}
          episodeTemplateId={episodeTemplateId}
          apply={apply}
          onSelectEpisode={onSelectEpisode}
          onSelectPage={onSelectPage}
          onEpisodeTemplateChange={onEpisodeTemplateChange}
        />
      </div>

      <div
        id="project-panel-panel-assets"
        className="project-panel-view asset-panel-view"
        role="tabpanel"
        aria-labelledby="project-panel-tab-assets"
        hidden={activeTab !== "assets"}
      >
        <AssetBrowser
          bundle={bundle}
          episode={episode}
          selectedAssetId={selectedAssetId}
          assetUrls={assetUrls}
          apply={apply}
          onBundle={onBundle}
          onSelectPage={onSelectPage}
          onSelectAsset={onSelectAsset}
        />
      </div>
    </aside>
  );
}
