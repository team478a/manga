const PROJECT_ID = "project-100-page";

function makeCanvas(pageNumber) {
  const pageId = `page-${String(pageNumber).padStart(3, "0")}`;
  const panelId = `panel-${String(pageNumber).padStart(3, "0")}`;
  const assetId = `asset-${String(pageNumber).padStart(3, "0")}`;
  return {
    schemaVersion: 1,
    pageId,
    width: 1600,
    height: 2400,
    backgroundColor: "#ffffff",
    panels: [{
      id: panelId,
      pageId,
      name: "メインコマ",
      x: 100,
      y: 100,
      width: 1400,
      height: 2100,
      rotation: 0,
      zIndex: 0,
      visible: true,
      locked: false,
      borderColor: "#111111",
      borderWidth: 4,
      fillColor: "#ffffff",
      shape: "rectangle",
      slant: 0,
      imageAssetId: assetId,
      imageFit: "cover",
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageRotation: 0,
      imageOpacity: 1,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    }],
    panelLayers: [{
      id: `layer-${String(pageNumber).padStart(3, "0")}`,
      panelId,
      name: "背景",
      type: "background",
      orderIndex: 0,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: "normal",
      assetId,
      sourceJobId: null,
      imageFit: "cover",
      imageOffsetX: 0,
      imageOffsetY: 0,
      imageScale: 1,
      imageRotation: 0,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    }],
    balloons: [],
    textObjects: [],
  };
}

export function makeCloudLongform100PageFixture() {
  const chapters = Array.from({ length: 10 }, (_, index) => ({
    id: `chapter-${String(index + 1).padStart(2, "0")}`,
    project_id: PROJECT_ID,
    title: `第${index + 1}章`,
    order_index: index,
    revision: 1,
  }));
  const episodes = chapters.map((chapter, index) => ({
    id: `episode-${String(index + 1).padStart(2, "0")}`,
    project_id: PROJECT_ID,
    title: `第${index + 1}話`,
    order_index: index,
    revision: 1,
  }));
  const scenes = Array.from({ length: 20 }, (_, index) => {
    const chapterIndex = Math.floor(index / 2);
    return {
      id: `scene-${String(index + 1).padStart(2, "0")}`,
      project_id: PROJECT_ID,
      chapter_id: chapters[chapterIndex].id,
      episode_id: episodes[chapterIndex].id,
      title: `シーン${index + 1}`,
      summary: `長編受入れ用シーン${index + 1}`,
      order_index: index % 2,
      revision: 1,
    };
  });
  const pages = Array.from({ length: 100 }, (_, index) => {
    const pageNumber = index + 1;
    const chapterIndex = Math.floor(index / 10);
    return {
      id: `page-${String(pageNumber).padStart(3, "0")}`,
      project_id: PROJECT_ID,
      episode_id: episodes[chapterIndex].id,
      page_number: pageNumber,
      order_index: index,
      width: 1600,
      height: 2400,
      background_color: "#ffffff",
      revision: 1,
      canvas: makeCanvas(pageNumber),
    };
  });
  const episodeChapterIds = Object.fromEntries(
    episodes.map((episode, index) => [episode.id, chapters[index].id]),
  );
  const pageSceneIds = Object.fromEntries(
    pages.map((page, index) => [page.id, scenes[Math.floor(index / 5)].id]),
  );
  const assets = pages.map((page) => ({
    id: page.canvas.panels[0].imageAssetId,
    width: 1600,
    height: 2400,
  }));
  const productionStates = pages.map((page) => ({
    pageId: page.id,
    status: "finalized",
    statusUpdatedAt: "2026-08-02T00:00:00.000Z",
    finalizedRevision: 1,
    reviewedContextRevision: 1,
    contextRevision: 1,
    isStale: false,
  }));
  return {
    project: {
      title: "100ページ受入れ作品",
      description: "決定的な長編受入れfixture",
      readingDirection: "rtl",
      width: 1600,
      height: 2400,
      dpi: 300,
    },
    chapters,
    episodes,
    scenes,
    pages,
    assets,
    productionStates,
    longform: {
      available: true,
      chapters,
      scenes,
      episodeChapterIds,
      pageSceneIds,
    },
  };
}
