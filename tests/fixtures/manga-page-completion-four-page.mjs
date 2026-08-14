const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;

export function createFourPageCompletionFixture() {
  const pages = [];
  let sequence = 1;
  for (let pageNumber = 1; pageNumber <= 4; pageNumber += 1) {
    const pageId = uuid(sequence++);
    const panels = [0, 1].map((panelIndex) => {
      const panelId = uuid(sequence++);
      const imageAssetId = uuid(sequence++);
      const y = panelIndex * 570 + 20;
      return {
        panel: {
          id: panelId, pageId, name: `${panelIndex + 1}コマ目`, x: 20, y,
          width: 760, height: 550, rotation: 0, zIndex: panelIndex * 4,
          visible: true, locked: false, borderColor: "#111111", borderWidth: 4,
          fillColor: "#ffffff", shape: "rectangle", slant: 0.12,
          imageAssetId, imageFit: "cover", imageOffsetX: 0, imageOffsetY: 0,
          imageScale: 1, imageRotation: 0, imageOpacity: 1, createdAt: "", updatedAt: "",
        },
        imageAssetId,
      };
    });
    const balloons = panels.map(({ panel }, panelIndex) => ({
      id: uuid(sequence++), pageId, name: `${panelIndex + 1}コマ目の吹き出し`,
      type: "speech_ellipse", x: 500, y: panel.y + 30, width: 220, height: 180,
      rotation: 0, zIndex: panel.zIndex + 2, visible: true, locked: false,
      fillColor: "#ffffff", strokeColor: "#111111", strokeWidth: 3, opacity: 1,
      tailDirection: "bottom_left", tailOffset: 0.5, createdAt: "", updatedAt: "",
    }));
    const dialogues = panels.map((_, panelIndex) => ({ panelIndex, text: `${pageNumber}ページ${panelIndex + 1}コマ目` }));
    const textObjects = balloons.map((balloon, panelIndex) => ({
      id: uuid(sequence++), pageId, parentBalloonId: balloon.id,
      name: `${panelIndex + 1}コマ目のセリフ`, text: dialogues[panelIndex].text,
      x: balloon.x + 20, y: balloon.y + 20, width: balloon.width - 40,
      height: balloon.height - 40, rotation: 0, zIndex: balloon.zIndex + 1,
      visible: true, locked: false, fontFamily: "sans-serif", fontSize: 28,
      fontWeight: 500, color: "#111111", writingMode: "vertical",
      textAlign: "start", verticalAlign: "top", lineHeight: 1.2,
      letterSpacing: 0, padding: 0, opacity: 1, createdAt: "", updatedAt: "",
    }));
    const canvas = {
      schemaVersion: 1, pageId, width: 800, height: 1200, backgroundColor: "#ffffff",
      panels: panels.map((item) => item.panel), panelLayers: [], balloons, textObjects,
    };
    pages.push({
      pageId, pageNumber, width: 800, height: 1200, canvas, dialogues,
      assetIds: panels.map((item) => item.imageAssetId),
      imageJobs: panels.map(({ panel, imageAssetId }) => ({
        id: uuid(sequence++), pageId, panelId: panel.id, status: "completed",
        outputAssetId: imageAssetId,
      })),
    });
  }
  return pages;
}
