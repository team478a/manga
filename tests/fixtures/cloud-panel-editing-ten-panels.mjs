const timestamp = "2026-08-25T00:00:00.000Z";

const panel = (index) => ({
  id: `panel-${index}`,
  pageId: "page-1",
  name: `コマ${index}`,
  x: (index - 1) * 100,
  y: 0,
  width: 100,
  height: 160,
  rotation: 0,
  zIndex: index - 1,
  visible: true,
  locked: false,
  borderColor: "#111111",
  borderWidth: 2,
  fillColor: "#ffffff",
  shape: "rectangle",
  slant: 0,
  imageAssetId: `asset-${index}-v2`,
  imageFit: "cover",
  imageOffsetX: index,
  imageOffsetY: -index,
  imageScale: 1,
  imageRotation: 0,
  imageOpacity: 1,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const layer = (index, version) => ({
  id: `layer-${index}-v${version}`,
  panelId: `panel-${index}`,
  name: `コマ${index} 画像v${version}`,
  type: version === 1 ? "background" : "correction",
  orderIndex: version,
  visible: version === 2,
  locked: false,
  opacity: 1,
  blendMode: "normal",
  assetId: `asset-${index}-v${version}`,
  sourceJobId: `job-${index}-v${version}`,
  imageFit: "cover",
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageScale: 1,
  imageRotation: 0,
  createdAt: `2026-08-${String(20 + version).padStart(2, "0")}T00:00:00.000Z`,
  updatedAt: timestamp,
});

export function makeTenPanelEditingFixture() {
  const indexes = Array.from({ length: 10 }, (_, index) => index + 1);
  return {
    canvas: {
      schemaVersion: 1,
      pageId: "page-1",
      width: 1000,
      height: 160,
      backgroundColor: "#ffffff",
      panels: indexes.map(panel),
      panelLayers: indexes.flatMap((index) => [layer(index, 1), layer(index, 2)]),
      balloons: indexes.map((index) => ({ id: `balloon-${index}`, pageId: "page-1", name: `吹き出し${index}`, type: "speech_ellipse", x: index * 10, y: 10, width: 80, height: 60, rotation: 0, zIndex: 20 + index, visible: true, locked: false, fillColor: "#ffffff", strokeColor: "#111111", strokeWidth: 2, opacity: 1, tailDirection: "bottom", tailOffset: 0.5, createdAt: timestamp, updatedAt: timestamp })),
      textObjects: indexes.map((index) => ({ id: `text-${index}`, pageId: "page-1", parentBalloonId: `balloon-${index}`, name: `セリフ${index}`, text: `変更前セリフ${index}`, writingMode: "vertical", x: index * 10 + 8, y: 18, width: 64, height: 44, rotation: 0, zIndex: 40 + index, visible: true, locked: false, fontFamily: "Noto Sans JP", fontSize: 16, fontWeight: 500, color: "#111111", textAlign: "center", verticalAlign: "middle", lineHeight: 1.5, letterSpacing: 0.05, padding: 4, opacity: 1, createdAt: timestamp, updatedAt: timestamp })),
    },
    panelDesigns: indexes.map((index) => ({ panelId: `panel-${index}`, revision: 2, design: { schemaVersion: 1, orderIndex: index, dialogueRefs: [`text-${index}`] } })),
    generationJobs: indexes.flatMap((index) => [1, 2].map((version) => ({ id: `job-${index}-v${version}`, panelId: `panel-${index}`, source_asset_id: version === 2 ? `asset-${index}-v1` : null, panelDesignSnapshot: { revision: 2 } }))),
    creditReservations: indexes.map((index) => ({ id: `credit-${index}`, jobId: `job-${index}-v2`, amount: 1 })),
  };
}
