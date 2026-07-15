import sharp from "sharp";
import type {
  Asset,
  Balloon,
  Page,
  Panel,
  PanelLayer,
  TextObject,
} from "@mangai/project-core";
import {
  balloonTailPoints,
  computeImagePlacement,
  layoutHorizontalText,
  layoutVerticalText,
  panelShapeSvgPath,
} from "@mangai/canvas-core";

export type RenderAsset = Pick<
  Asset,
  "id" | "mimeType" | "width" | "height"
> & {
  bytes: Uint8Array;
};

export async function renderPagePng(input: {
  page: Page;
  panels: Panel[];
  panelLayers: PanelLayer[];
  balloons: Balloon[];
  textObjects: TextObject[];
  assets: Map<string, RenderAsset>;
}) {
  const { page, assets } = input;
  const svgAssets = await prepareSvgAssets(
    assets,
    [
      page.imageAssetId,
      ...input.panels.map((panel) => panel.imageAssetId),
      ...input.panelLayers.map((layer) => layer.assetId),
    ].filter((id): id is string => Boolean(id)),
  );
  const objects = [
    ...input.panels.map((item) => ({ ...item, objectType: "panel" as const })),
    ...input.balloons.map((item) => ({
      ...item,
      objectType: "balloon" as const,
    })),
    ...input.textObjects.map((item) => ({
      ...item,
      objectType: "text" as const,
    })),
  ]
    .filter((item) => item.visible)
    .sort((a, b) => a.zIndex - b.zIndex);
  const body: string[] = [
    `<rect width="${page.width}" height="${page.height}" fill="${attr(page.backgroundColor)}"/>`,
  ];
  if (page.imageAssetId) {
    const asset = svgAssets.get(page.imageAssetId);
    if (asset)
      body.push(
        `<image href="${dataUrl(asset)}" width="${page.width}" height="${page.height}" preserveAspectRatio="none"/>`,
      );
  }
  for (const item of objects) {
    if (item.objectType === "panel")
      body.push(
        renderPanel(
          item,
          svgAssets,
          input.panelLayers.filter((layer) => layer.panelId === item.id),
        ),
      );
    else if (item.objectType === "balloon") body.push(renderBalloon(item));
    else body.push(renderText(item));
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${page.width}" height="${page.height}" viewBox="0 0 ${page.width} ${page.height}">${body.join("")}</svg>`;
  return sharp(Buffer.from(svg), {
    density: 72,
    limitInputPixels: 100_000_000,
  })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export async function renderPanelLayerCachePng(input: {
  panel: Panel;
  panelLayers: PanelLayer[];
  assets: Map<string, RenderAsset>;
  cacheKey: string;
}) {
  const assetIds = input.panelLayers
    .map((layer) => layer.assetId)
    .filter((id): id is string => Boolean(id));
  const assets = await prepareSvgAssets(input.assets, assetIds);
  const width = Math.max(1, Math.round(input.panel.width));
  const height = Math.max(1, Math.round(input.panel.height));
  const content = renderSeparatedPanelLayers(
    input.panel,
    assets,
    input.panelLayers,
    `cache-clip-${input.panel.id}`,
  );
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${input.panel.width} ${input.panel.height}">${content}</svg>`;
  return sharp(Buffer.from(svg), {
    density: 72,
    limitInputPixels: 100_000_000,
  })
    .withMetadata({
      exif: { IFD0: { ImageDescription: input.cacheKey } },
    })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function prepareSvgAssets(
  assets: Map<string, RenderAsset>,
  assetIds: string[],
) {
  const prepared = new Map(assets);
  for (const id of new Set(assetIds)) {
    const asset = assets.get(id);
    if (!asset || asset.mimeType !== "image/webp") continue;
    prepared.set(id, {
      ...asset,
      mimeType: "image/png",
      bytes: await sharp(Buffer.from(asset.bytes)).png().toBuffer(),
    });
  }
  return prepared;
}

function renderPanel(
  panel: Panel,
  assets: Map<string, RenderAsset>,
  layers: PanelLayer[],
) {
  const clipId = `clip-${panel.id}`;
  const shape = panelShapeSvgPath(panel);
  const parts = [
    `<g transform="translate(${panel.x} ${panel.y}) rotate(${panel.rotation})">`,
    `<path d="${shape}" fill="${attr(panel.fillColor)}"/>`,
  ];
  const separatedLayers = layers
    .filter((layer) => layer.type !== "flattened_legacy")
    .sort((a, b) => a.orderIndex - b.orderIndex);
  if (separatedLayers.length) {
    parts.push(renderSeparatedPanelLayers(panel, assets, layers, clipId));
  } else {
    const asset = panel.imageAssetId
      ? assets.get(panel.imageAssetId)
      : undefined;
    if (asset && asset.width > 0 && asset.height > 0) {
      const placement = computeImagePlacement(
        { width: asset.width, height: asset.height },
        { x: 0, y: 0, width: panel.width, height: panel.height },
        {
          fit: panel.imageFit,
          scale: panel.imageScale,
          offsetX: panel.imageOffsetX,
          offsetY: panel.imageOffsetY,
        },
      );
      parts.push(
        `<defs><clipPath id="${clipId}"><path d="${shape}"/></clipPath></defs>`,
        `<image href="${dataUrl(asset)}" x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" opacity="${panel.imageOpacity}" transform="rotate(${panel.imageRotation} ${placement.x} ${placement.y})" clip-path="url(#${clipId})"/>`,
      );
    }
  }
  parts.push(
    `<path d="${shape}" fill="none" stroke="${attr(panel.borderColor)}" stroke-width="${panel.borderWidth}"/>`,
    `</g>`,
  );
  return parts.join("");
}

function renderSeparatedPanelLayers(
  panel: Panel,
  assets: Map<string, RenderAsset>,
  layers: PanelLayer[],
  clipId: string,
) {
  const shape = panelShapeSvgPath(panel);
  const definitions = [
    `<clipPath id="${clipId}"><path d="${shape}"/></clipPath>`,
  ];
  const composite: string[] = [];
  for (const layer of layers
    .filter((item) => item.type !== "flattened_legacy")
    .sort((a, b) => a.orderIndex - b.orderIndex)) {
    if (!layer.visible) continue;
    const layerAsset = layer.assetId ? assets.get(layer.assetId) : undefined;
    if (!layerAsset || layerAsset.width <= 0 || layerAsset.height <= 0)
      continue;
    const placement = computeImagePlacement(
      { width: layerAsset.width, height: layerAsset.height },
      { x: 0, y: 0, width: panel.width, height: panel.height },
      {
        fit: layer.imageFit,
        scale: layer.imageScale,
        offsetX: layer.imageOffsetX,
        offsetY: layer.imageOffsetY,
      },
    );
    const image = `<image href="${dataUrl(layerAsset)}" x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" opacity="${layer.opacity}" transform="rotate(${layer.imageRotation} ${placement.x} ${placement.y})"/>`;
    if (layer.type === "mask") {
      const maskId = `mask-${panel.id}-${layer.id}`;
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
        image.replace("/>", ` style="mix-blend-mode:${layer.blendMode}"/>`),
      );
    }
  }
  return `<defs>${definitions.join("")}</defs><g clip-path="url(#${clipId})">${composite.join("")}</g>`;
}

function renderBalloon(balloon: Balloon) {
  const tail = balloonTailPoints(balloon);
  const parts = [
    `<g transform="translate(${balloon.x} ${balloon.y}) rotate(${balloon.rotation})" opacity="${balloon.opacity}">`,
  ];
  if (tail.length)
    parts.push(
      `<polygon points="${pairs(tail)}" fill="${attr(balloon.fillColor)}" stroke="${attr(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}"/>`,
    );
  if (balloon.type === "speech_ellipse")
    parts.push(
      `<ellipse cx="${balloon.width / 2}" cy="${balloon.height / 2}" rx="${balloon.width / 2}" ry="${balloon.height / 2}" fill="${attr(balloon.fillColor)}" stroke="${attr(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}"/>`,
    );
  else
    parts.push(
      `<rect width="${balloon.width}" height="${balloon.height}" rx="${balloon.type === "speech_rounded" ? 30 : 0}" fill="${attr(balloon.fillColor)}" stroke="${attr(balloon.strokeColor)}" stroke-width="${balloon.strokeWidth}"/>`,
    );
  parts.push("</g>");
  return parts.join("");
}

function renderText(item: TextObject) {
  const common = `font-family="${attr(item.fontFamily)}" font-weight="${item.fontWeight}" fill="${attr(item.color)}" opacity="${item.opacity}"`;
  const transform = `translate(${item.x} ${item.y}) rotate(${item.rotation})`;
  if (item.writingMode === "vertical") {
    const layout = layoutVerticalText(
      item.text,
      {
        x: item.padding,
        y: item.padding,
        width: Math.max(1, item.width - item.padding * 2),
        height: Math.max(1, item.height - item.padding * 2),
      },
      {
        fontSize: item.fontSize,
        lineHeight: item.lineHeight,
        letterSpacing: item.letterSpacing,
      },
    );
    const baseGlyphs = layout.glyphs
      .map((glyph) => {
        const glyphFontSize = glyph.tateChuYoko
          ? item.fontSize * 0.62
          : item.fontSize;
        return `<text x="${glyph.x}" y="${glyph.y}" text-anchor="middle" dominant-baseline="central" ${common} font-size="${glyphFontSize}"${glyph.tateChuYoko ? ` letter-spacing="0" aria-label="${attr(glyph.value)}"` : ""}>${text(glyph.value)}</text>`;
      })
      .join("");
    const rubyGlyphs = layout.rubyGlyphs
      .map(
        (glyph) =>
          `<text x="${glyph.x}" y="${glyph.y}" text-anchor="middle" dominant-baseline="central" ${common} font-size="${item.fontSize * 0.42}" letter-spacing="0">${text(glyph.value)}</text>`,
      )
      .join("");
    return `<g transform="${transform}">${baseGlyphs}${rubyGlyphs}</g>`;
  }
  const layout = layoutHorizontalText(
    item.text,
    {
      x: item.padding,
      y: item.padding,
      width: Math.max(1, item.width - item.padding * 2),
      height: Math.max(1, item.height - item.padding * 2),
    },
    {
      fontSize: item.fontSize,
      lineHeight: item.lineHeight,
      letterSpacing: item.letterSpacing,
      textAlign: item.textAlign,
      verticalAlign: item.verticalAlign,
    },
  );
  const lines = layout.lines
    .map(
      (line) =>
        `<text x="${line.x}" y="${line.y}" text-anchor="start" font-size="${item.fontSize}" letter-spacing="${item.letterSpacing}" ${common}>${text(line.value)}</text>`,
    )
    .join("");
  const rubyRuns = layout.rubyRuns
    .map(
      (ruby) =>
        `<text x="${ruby.x}" y="${ruby.y}" text-anchor="middle" font-size="${item.fontSize * 0.42}" letter-spacing="0" ${common}>${text(ruby.value)}</text>`,
    )
    .join("");
  return `<g transform="${transform}">${lines}${rubyRuns}</g>`;
}
function dataUrl(asset: RenderAsset) {
  return `data:${asset.mimeType};base64,${Buffer.from(asset.bytes).toString("base64")}`;
}
function pairs(values: number[]) {
  const result: string[] = [];
  for (let index = 0; index < values.length; index += 2)
    result.push(`${values[index]},${values[index + 1]}`);
  return result.join(" ");
}
function attr(value: string) {
  return text(value).replace(/"/g, "&quot;");
}
function text(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
