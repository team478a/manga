import { dialogueInnerRegion, fitBalloonDialogueTextLayout, type PageCanvas, type Balloon, type TextObject } from "@mangai/canvas-core";

const id = (kind: number, index: number) => `${kind}0000000-0000-4000-8000-${String(index).padStart(12, "0")}`;

// Synthetic, code-owned drawing fixtures; not AI art or user manuscripts.
export function createMangaVisualFixture(): PageCanvas[] {
  return [1, 2, 3, 4].map(pageNumber => {
    const pageId = id(1, pageNumber);
    const canvas: PageCanvas = { schemaVersion: 1, pageId, width: 1600, height: 2400, backgroundColor: "#fff", panels: [], panelLayers: [], balloons: [], textObjects: [] };
    for (let slot = 0; slot < 4; slot += 1) {
      const index = (pageNumber - 1) * 4 + slot + 1;
      const x = slot % 2 === 0 ? 820 : 60, y = slot < 2 ? 80 : 1240;
      canvas.panels.push({ id: id(2, index), pageId, name: `Fixture panel ${index}`, x, y, width: 720, height: 1080, rotation: 0, zIndex: slot, visible: true, locked: false, borderColor: "#111", borderWidth: 4, fillColor: "#fff", shape: "rectangle", slant: 0, imageAssetId: id(5, index), imageFit: "cover", imageOffsetX: 0, imageOffsetY: 0, imageScale: 1, imageRotation: 0, imageOpacity: 1, createdAt: "", updatedAt: "" });
      const balloon: Balloon = { id: id(3, index), pageId, name: `Fixture balloon ${index}`, type: slot === 1 ? "speech_rounded" : slot === 2 ? "narration_box" : "speech_ellipse", x: slot === 3 ? x + 620 : x + 160, y: slot === 3 ? y + 360 : y + 90, width: slot === 1 || slot === 2 ? 400 : 300, height: slot === 1 ? 200 : slot === 2 ? 220 : 400, rotation: slot === 2 ? 15 : slot === 3 ? 90 : 0, zIndex: 20 + slot * 2, visible: true, locked: false, fillColor: "#fff", strokeColor: "#111", strokeWidth: 3, opacity: 1, tailDirection: "none", tailOffset: 0.5, createdAt: "", updatedAt: "" };
      const value = ["「きゃー、｜鍵《かぎ》だ。」", "｜閉店《へいてん》だよ。", "｜葵《あおい》は、キーを受け取った。", "ッ、ー…「本当に？」"][slot];
      const fit = fitBalloonDialogueTextLayout(value, balloon);
      if (!fit) throw new Error("Visual fixture text did not fit");
      const text: TextObject = { id: id(4, index), pageId, parentBalloonId: balloon.id, name: `Fixture text ${index}`, text: value, ...dialogueInnerRegion(balloon), zIndex: balloon.zIndex + 1, visible: true, locked: false, fontFamily: "Yu Gothic", fontWeight: 500, color: "#111", lineHeight: 1.2, letterSpacing: 0, opacity: 1, createdAt: "", updatedAt: "", ...fit };
      if (slot === 2) { text.writingMode = "horizontal"; text.textAlign = "center"; text.verticalAlign = "middle"; }
      canvas.balloons.push(balloon); canvas.textObjects.push(text);
    }
    return canvas;
  });
}

export function fixedPanelSvg(index: number) {
  const color = ["#d8e8f4", "#f7e3ca", "#dbeedc", "#e8def4"][(index - 1) % 4];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1080"><rect width="720" height="1080" fill="${color}"/><path d="M0 780L720 650V1080H0Z" fill="#c5c5c5"/><circle cx="240" cy="770" r="60" fill="#fff" stroke="#111" stroke-width="6"/><path d="M160 980V850Q240 800 320 850V980" fill="#fff" stroke="#111" stroke-width="6"/><circle cx="500" cy="820" r="50" fill="#fff" stroke="#111" stroke-width="6"/><path d="M440 1020V890Q500 850 560 890V1020" fill="#333" stroke="#111" stroke-width="6"/><text x="35" y="1040" font-size="26" fill="#111">FIXTURE ${index} - NOT AI ART</text></svg>`;
}
