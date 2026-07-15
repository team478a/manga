import React from "react";
import type { Episode, Page, ProjectBundle } from "@mangai/project-core";
import type { EpisodeTemplateId } from "@mangai/canvas-core";
import { AssetBrowser } from "../assets/AssetBrowser";
import { ProjectStructureTab } from "../project/ProjectStructureTab";
import { Tabs } from "../common/Tabs";

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
  const [activeTab, setActiveTab] =
    React.useState<ProjectPanelTab>(readPanelTab);

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
      aria-label="Project構成と素材"
    >
      <div className="project-panel-tabs">
        <Tabs
          idPrefix="project-panel"
          label="Projectパネル"
          value={activeTab}
          options={[
            { id: "structure", label: "構成", count: pages.length },
            { id: "assets", label: "素材", count: bundle.assets.length },
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
