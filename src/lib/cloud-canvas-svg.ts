import {
  balloonTailPoints,
  computeImagePlacement,
  layoutHorizontalText,
  layoutVerticalText,
  panelShapeSvgPath,
  type Balloon,
  type PageCanvas,
  type Panel,
  type PanelLayer,
  type TextObject,
} from "@mangai/canvas-core";

export type CloudCanvasSvgAsset = {
  href: string;
  width?: number;
  height?: number;
};

function escapeText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function finite(value: number | undefined, fallback: number) {
  return Number.isFinite(value) ? (value as number) : fallback;
}

function renderImage(
  href: string,
  placement: { x: number; y: number; width: number; height: number },
  opacity: number,
  rotation: number,
) {
  return `<image href="${escapeAttribute(href)}" x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" opacity="${opacity}" transform="rotate(${rotation} ${placement.x} ${placement.y})"/>`;
}

function imagePlacement(
  asset: CloudCanvasSvgAsset,
  panel: Panel,
  input: Pick<
    PanelLayer,
    "imageFit" | "imageScale" | "imageOffsetX" | "imageOffsetY"
  >,
) {
  return computeImagePlacement(
    {
      width: Math.max(1, finite(asset.width, panel.width)),
      height: Math.max(1, finite(asset.height, panel.height)),
    },
    { x: 0, y: 0, width: panel.width, height: panel.height },
    {
      fit: input.imageFit ?? "cover",
      scale: finite(input.imageScale, 1),
      offsetX: finite(input.imageOffsetX, 0),
      offsetY: finite(input.imageOffsetY, 0),
    },
  );
}

function normalizedPanel(panel: Panel): Panel {
  return {
    ...panel,
    shape: panel.shape ?? "rectangle",
    slant: finite(panel.slant, 0.12),
  };
}

function renderSeparatedLayers(
  panel: Panel,
  layers: readonly PanelLayer[],
  assets: ReadonlyMap<string, CloudCanvasSvgAsset>,
  clipId: string,
) {
  const shape = panelShapeSvgPath(panel);
  const definitions = [
    `<clipPath id="${clipId}"><path d="${shape}"/></clipPath>`,
  ];
  const composite: string[] = [];

  for (const layer of [...layers]
    .filter((item) => item.type !== "flattened_legacy")
    .sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (!layer.visible || !layer.assetId) continue;
    const asset = assets.get(layer.assetId);
    if (!asset) continue;
    const placement = imagePlacement(asset, panel, layer);
    const image = renderImage(
      asset.href,
      placement,
      finite(layer.opacity, 1),
      finite(layer.imageRotation, 0),
    );
    if (layer.type === "mask") {
      const maskId = `mask-${safeId(panel.id)}-${safeId(layer.id)}`;
      definitions.push(
        `<mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${panel.width}" height="${panel.height}" style="mask-type:alpha">${image}</mask>`,
      );
      const masked = composite.join("");
      composite.splice(
        0,
        composite.length,
        `<g mask="url(#${maskId})">${masked}</g>`,
      );
    } else {
      composite.push(
        image.replace(
          "/>",
          ` style="mix-blend-mode:${layer.blendMode ?? "normal"}"/>`,
        ),
      );
    }
  }

  return `<defs>${definitions.join("")}</defs><g clip-path="url(#${clipId})">${composite.join("")}</g>`;
}

function renderPanel(
  sourcePanel: Panel,
  layers: readonly PanelLayer[],
  assets: ReadonlyMap<string, CloudCanvasSvgAsset>,
) {
  const panel = normalizedPanel(sourcePanel);
  const clipId = `clip-${safeId(panel.id)}`;
  const shape = panelShapeSvgPath(panel);
  const content = [
    `<g transform="translate(${panel.x} ${panel.y}) rotate(${panel.rotation})">`,
    `<path d="${shape}" fill="${escapeAttribute(panel.fillColor)}"/>`,
  ];
  const separatedLayers = layers.filter(
    (layer) => layer.type !== "flattened_legacy",
  );

  if (separatedLayers.length) {
    content.push(renderSeparatedLayers(panel, layers, assets, clipId));
  } else if (panel.imageAssetId) {
    const asset = assets.get(panel.imageAssetId);
    if (asset) {
      const placement = imagePlacement(asset, panel, {
        imageFit: panel.imageFit ?? "cover",
        imageScale: finite(panel.imageScale, 1),
        imageOffsetX: finite(panel.imageOffsetX, 0),
        imageOffsetY: finite(panel.imageOffsetY, 0),
      });
      content.push(
        `<defs><clipPath id="${clipId}"><path d="${shape}"/></clipPath></defs>`,
        renderImage(
          asset.href,
          placement,
          finite(panel.imageOpacity, 1),
          finite(panel.imageRotation, 0),
        ).replace("/>", ` clip-path="url(#${clipId})"/>`),
      );
    }
  }

  content.push(
    `<path d="${shape}" fill="none" stroke="${escapeAttribute(panel.borderColor)}" stroke-width="${panel.borderWidth}"/>`,
    "</g>",
  );
  return content.join("");
}

function points(values: readonly number[]) {
  const output: string[] = [];
  for (let index = 0; index < values.length; index += 2)
    output.push(`${values[index]},${values[index + 1]}`);
  return output.join(" ");
}

function renderBalloon(balloon: Balloon) {
  const normalized = {
    ...balloon,
    tailDirection: balloon.tailDirection ?? "none",
    tailOffset: finite(balloon.tailOffset, 0.5),
  };
  const tail = balloonTailPoints(normalized);
  const common = `fill="${escapeAttribute(balloon.fillColor)}" stroke="${escapeAttribute(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}"`;
  const content = [
    `<g transform="translate(${balloon.x} ${balloon.y}) rotate(${balloon.rotation})" opacity="${finite(balloon.opacity, 1)}">`,
  ];
  if (tail.length)
    content.push(`<polygon points="${points(tail)}" ${common}/>`);
  content.push(
    balloon.type === "speech_ellipse"
      ? `<ellipse cx="${balloon.width / 2}" cy="${balloon.height / 2}" rx="${balloon.width / 2}" ry="${balloon.height / 2}" ${common}/>`
      : `<rect width="${balloon.width}" height="${balloon.height}" rx="${balloon.type === "speech_rounded" ? 30 : 0}" ${common}/>` ,
    "</g>",
  );
  return content.join("");
}

function renderText(item: TextObject) {
  const fontSize = finite(item.fontSize, 24);
  const padding = finite(item.padding, 0);
  const common = `font-family="${escapeAttribute(item.fontFamily)}" font-weight="${item.fontWeight}" fill="${escapeAttribute(item.color)}" opacity="${finite(item.opacity, 1)}"`;
  const transform = `translate(${item.x} ${item.y}) rotate(${item.rotation})`;
  const box = {
    x: padding,
    y: padding,
    width: Math.max(1, item.width - padding * 2),
    height: Math.max(1, item.height - padding * 2),
  };

  if (item.writingMode === "vertical") {
    const layout = layoutVerticalText(item.text, box, {
      fontSize,
      lineHeight: finite(item.lineHeight, 1.2),
      letterSpacing: finite(item.letterSpacing, 0),
    });
    const glyphs = layout.glyphs
      .map((glyph) => {
        const glyphFontSize = glyph.tateChuYoko ? fontSize * 0.62 : fontSize;
        return `<text x="${glyph.x}" y="${glyph.y}" text-anchor="middle" dominant-baseline="central" ${common} font-size="${glyphFontSize}"${glyph.tateChuYoko ? ` letter-spacing="0" aria-label="${escapeAttribute(glyph.value)}"` : ""}>${escapeText(glyph.value)}</text>`;
      })
      .join("");
    const ruby = layout.rubyGlyphs
      .map(
        (glyph) =>
          `<text x="${glyph.x}" y="${glyph.y}" text-anchor="middle" dominant-baseline="central" ${common} font-size="${fontSize * 0.42}" letter-spacing="0">${escapeText(glyph.value)}</text>`,
      )
      .join("");
    return `<g transform="${transform}">${glyphs}${ruby}</g>`;
  }

  const layout = layoutHorizontalText(item.text, box, {
    fontSize,
    lineHeight: finite(item.lineHeight, 1.2),
    letterSpacing: finite(item.letterSpacing, 0),
    textAlign: item.textAlign ?? "start",
    verticalAlign: item.verticalAlign ?? "top",
  });
  const lines = layout.lines
    .map(
      (line) =>
        `<text x="${line.x}" y="${line.y}" text-anchor="start" font-size="${fontSize}" letter-spacing="${finite(item.letterSpacing, 0)}" ${common}>${escapeText(line.value)}</text>`,
    )
    .join("");
  const ruby = layout.rubyRuns
    .map(
      (run) =>
        `<text x="${run.x}" y="${run.y}" text-anchor="middle" font-size="${fontSize * 0.42}" letter-spacing="0" ${common}>${escapeText(run.value)}</text>`,
    )
    .join("");
  return `<g transform="${transform}">${lines}${ruby}</g>`;
}

export function createCloudCanvasSvg(
  canvas: PageCanvas,
  assets: ReadonlyMap<string, CloudCanvasSvgAsset>,
) {
  const layersByPanel = new Map<string, PanelLayer[]>();
  for (const layer of canvas.panelLayers) {
    const panelLayers = layersByPanel.get(layer.panelId) ?? [];
    panelLayers.push(layer);
    layersByPanel.set(layer.panelId, panelLayers);
  }
  const nodes = [
    ...canvas.panels.map((item) => ({
      zIndex: item.zIndex,
      visible: item.visible,
      svg: () => renderPanel(item, layersByPanel.get(item.id) ?? [], assets),
    })),
    ...canvas.balloons.map((item) => ({
      zIndex: item.zIndex,
      visible: item.visible,
      svg: () => renderBalloon(item),
    })),
    ...canvas.textObjects.map((item) => ({
      zIndex: item.zIndex,
      visible: item.visible,
      svg: () => renderText(item),
    })),
  ]
    .filter((item) => item.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((item) => item.svg())
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><rect width="100%" height="100%" fill="${escapeAttribute(canvas.backgroundColor)}"/>${nodes}</svg>`;
}
