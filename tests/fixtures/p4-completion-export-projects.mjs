import { createCompletionModeProfile } from "../../packages/shared/src/index.ts";

const projects = [
  ["longform_story", "cloud_general", "長編ストーリー受入作品"],
  ["kindle_explainer", "cloud_general", "Kindle解説受入作品"],
  ["adult_local", "desktop_local", "成人向けローカル受入作品"],
];

export function p4CompletionExportProjects() {
  return projects.map(([mode, surface, title], projectIndex) => {
    const profile = createCompletionModeProfile(mode, surface);
    const pages = [2, 1].map((pageNumber) => ({
      id: `${mode}-page-${pageNumber}`,
      pageNumber,
      width: profile.pagePreset.width,
      height: profile.pagePreset.height,
      backgroundColor: pageNumber === 1 ? "#f4ead8" : "#dce9f5",
      canvas: {
        schemaVersion: 1,
        pageId: `${mode}-page-${pageNumber}`,
        width: profile.pagePreset.width,
        height: profile.pagePreset.height,
        backgroundColor: pageNumber === 1 ? "#f4ead8" : "#dce9f5",
        panels: [], panelLayers: [], balloons: [],
        textObjects: [{
          id: `${mode}-text-${pageNumber}`,
          text: `${title} ${pageNumber}ページ`,
          writingMode: "vertical",
          x: 100, y: 100, width: 400, height: 800,
          fontSize: 48, visible: true,
        }],
      },
    }));
    return {
      schemaVersion: 1,
      ownerProfileId: `owner-${projectIndex + 1}`,
      project: {
        id: `project-${mode}`,
        title,
        completionModeProfile: profile,
        width: profile.pagePreset.width,
        height: profile.pagePreset.height,
        dpi: profile.pagePreset.dpi,
        readingDirection: profile.pagePreset.readingDirection,
      },
      pages,
    };
  });
}
