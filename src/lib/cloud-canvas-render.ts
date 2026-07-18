import sharp from "sharp";
import type { PageCanvas, PanelLayer } from "@mangai/canvas-core";

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function dataUri(mimeType: string, bytes: Uint8Array) {
  return `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
}

function panelAsset(
  panelId: string,
  fallback: string | null,
  layers: PanelLayer[],
) {
  return (
    layers
      .filter(
        (layer) => layer.panelId === panelId && layer.visible && layer.assetId,
      )
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .at(-1)?.assetId ?? fallback
  );
}

export async function renderCloudCanvasPng(
  canvas: PageCanvas,
  assets: Map<string, { mimeType: string; bytes: Uint8Array }>,
) {
  const nodes: Array<{ zIndex: number; svg: string }> = [];
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const assetId = panelAsset(
      panel.id,
      panel.imageAssetId,
      canvas.panelLayers,
    );
    const asset = assetId ? assets.get(assetId) : null;
    const clipId = `clip-${panel.id}`;
    nodes.push({
      zIndex: panel.zIndex,
      svg:
        `<g transform="translate(${panel.x} ${panel.y}) rotate(${panel.rotation} ${panel.width / 2} ${panel.height / 2})">` +
        `<defs><clipPath id="${clipId}"><rect width="${panel.width}" height="${panel.height}"/></clipPath></defs>` +
        `<rect width="${panel.width}" height="${panel.height}" fill="${escapeXml(panel.fillColor)}"/>` +
        (asset
          ? `<image href="${dataUri(asset.mimeType, asset.bytes)}" width="${panel.width}" height="${panel.height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})" opacity="${panel.imageOpacity}"/>`
          : "") +
        `<rect width="${panel.width}" height="${panel.height}" fill="none" stroke="${escapeXml(panel.borderColor)}" stroke-width="${panel.borderWidth}"/>` +
        `</g>`,
    });
  }
  for (const balloon of canvas.balloons.filter((item) => item.visible)) {
    const common = `fill="${escapeXml(balloon.fillColor)}" stroke="${escapeXml(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}" opacity="${balloon.opacity}"`;
    const transform = `translate(${balloon.x} ${balloon.y}) rotate(${balloon.rotation} ${balloon.width / 2} ${balloon.height / 2})`;
    nodes.push({
      zIndex: balloon.zIndex,
      svg:
        balloon.type === "speech_ellipse"
          ? `<ellipse transform="${transform}" cx="${balloon.width / 2}" cy="${balloon.height / 2}" rx="${balloon.width / 2}" ry="${balloon.height / 2}" ${common}/>`
          : `<rect transform="${transform}" width="${balloon.width}" height="${balloon.height}" rx="${balloon.type === "speech_rounded" ? 32 : 0}" ${common}/>`,
    });
  }
  for (const text of canvas.textObjects.filter((item) => item.visible)) {
    const writing =
      text.writingMode === "vertical"
        ? "writing-mode:vertical-rl;text-orientation:mixed;"
        : "";
    nodes.push({
      zIndex: text.zIndex,
      svg: `<text x="${text.x + text.padding}" y="${text.y + text.padding + text.fontSize}" transform="rotate(${text.rotation} ${text.x + text.width / 2} ${text.y + text.height / 2})" fill="${escapeXml(text.color)}" font-family="${escapeXml(text.fontFamily)}" font-size="${text.fontSize}" font-weight="${text.fontWeight}" opacity="${text.opacity}" style="${writing}white-space:pre-wrap">${escapeXml(text.text)}</text>`,
    });
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><rect width="100%" height="100%" fill="${escapeXml(canvas.backgroundColor)}"/>${nodes
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((node) => node.svg)
    .join("")}</svg>`;
  return new Uint8Array(
    await sharp(Buffer.from(svg), { limitInputPixels: 100_000_000 })
      .png()
      .toBuffer(),
  );
}
