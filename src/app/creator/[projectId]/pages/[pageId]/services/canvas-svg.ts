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

export function createCanvasSvg(
  canvas: PageCanvas,
  assetUrls: ReadonlyMap<string, string>,
) {
  const layersByPanel = new Map<string, PanelLayer[]>();
  for (const layer of canvas.panelLayers) {
    const list = layersByPanel.get(layer.panelId) ?? [];
    list.push(layer);
    layersByPanel.set(layer.panelId, list);
  }

  const elements: string[] = [];
  for (const panel of canvas.panels.filter((item) => item.visible)) {
    const layers = (layersByPanel.get(panel.id) ?? [])
      .filter((layer) => layer.visible && layer.assetId)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    const assetId = layers.at(-1)?.assetId ?? panel.imageAssetId;
    const href = assetId ? assetUrls.get(assetId) : null;
    elements.push(
      `<g transform="translate(${panel.x} ${panel.y}) rotate(${panel.rotation} ${panel.width / 2} ${panel.height / 2})">` +
        `<rect width="${panel.width}" height="${panel.height}" fill="${escapeXml(panel.fillColor)}" stroke="${escapeXml(panel.borderColor)}" stroke-width="${panel.borderWidth}"/>` +
        (href
          ? `<image href="${escapeXml(href)}" width="${panel.width}" height="${panel.height}" preserveAspectRatio="xMidYMid slice" opacity="${layers.at(-1)?.opacity ?? panel.imageOpacity}"/>`
          : "") +
        `</g>`,
    );
  }

  for (const balloon of canvas.balloons.filter((item) => item.visible)) {
    const transform = `translate(${balloon.x} ${balloon.y}) rotate(${balloon.rotation} ${balloon.width / 2} ${balloon.height / 2})`;
    elements.push(
      balloon.type === "speech_ellipse"
        ? `<ellipse transform="${transform}" cx="${balloon.width / 2}" cy="${balloon.height / 2}" rx="${balloon.width / 2}" ry="${balloon.height / 2}" fill="${escapeXml(balloon.fillColor)}" stroke="${escapeXml(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}" opacity="${balloon.opacity}"/>`
        : `<rect transform="${transform}" width="${balloon.width}" height="${balloon.height}" rx="${balloon.type === "speech_rounded" ? 32 : 0}" fill="${escapeXml(balloon.fillColor)}" stroke="${escapeXml(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}" opacity="${balloon.opacity}"/>`,
    );
  }

  for (const text of canvas.textObjects.filter((item) => item.visible)) {
    const writingMode =
      text.writingMode === "vertical" ? "vertical-rl" : "horizontal-tb";
    elements.push(
      `<foreignObject x="${text.x}" y="${text.y}" width="${text.width}" height="${text.height}" transform="rotate(${text.rotation} ${text.x + text.width / 2} ${text.y + text.height / 2})" opacity="${text.opacity}"><div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing:border-box;width:100%;height:100%;padding:${text.padding}px;color:${escapeXml(text.color)};font-family:${escapeXml(text.fontFamily)};font-size:${text.fontSize}px;font-weight:${text.fontWeight};line-height:${text.lineHeight};letter-spacing:${text.letterSpacing}px;writing-mode:${writingMode};white-space:pre-wrap;overflow:hidden">${escapeXml(text.text)}</div></foreignObject>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><rect width="100%" height="100%" fill="${escapeXml(canvas.backgroundColor)}"/>${elements.join("")}</svg>`;
}
