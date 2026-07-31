import {
  layoutHorizontalText,
  layoutVerticalText,
  type PageCanvas,
} from "@mangai/canvas-core";

export type CloudManuscriptPreflightIssue = {
  code:
    | "cover_missing"
    | "page_order"
    | "empty_panel"
    | "missing_asset"
    | "low_resolution"
    | "text_overflow";
  severity: "error" | "warning";
  message: string;
  pageId: string | null;
  pageNumber: number | null;
  panelId: string | null;
};

export type CloudManuscriptPreflightReport = {
  ready: boolean;
  pageCount: number;
  targetPageCount: number;
  totalPanelCount: number;
  completedPanelCount: number;
  errorCount: number;
  warningCount: number;
  issues: CloudManuscriptPreflightIssue[];
  truncatedIssueCount: number;
};

type PreflightPage = {
  id: string;
  page_number: number;
  canvas: PageCanvas;
};

type PreflightAsset = {
  id: string;
  width: number;
  height: number;
};

function textOverflows(canvas: PageCanvas) {
  return canvas.textObjects.filter((text) => {
    if (!text.visible || !text.text.trim()) return false;
    const padding = Math.max(0, text.padding);
    const box = {
      x: text.x + padding,
      y: text.y + padding,
      width: Math.max(1, text.width - padding * 2),
      height: Math.max(1, text.height - padding * 2),
    };
    const options = {
      fontSize: text.fontSize,
      lineHeight: text.lineHeight,
      letterSpacing: text.letterSpacing,
    };
    return text.writingMode === "vertical"
      ? layoutVerticalText(text.text, box, options).overflow
      : layoutHorizontalText(text.text, box, {
          ...options,
          textAlign: text.textAlign,
          verticalAlign: text.verticalAlign,
        }).overflow;
  });
}

export function analyzeCloudManuscript(input: {
  coverPageId: string | null;
  pages: PreflightPage[];
  assets: PreflightAsset[];
  targetPageCount?: number;
  issueLimit?: number;
}): CloudManuscriptPreflightReport {
  const targetPageCount = input.targetPageCount ?? 8;
  const issueLimit = input.issueLimit ?? 100;
  const issues: CloudManuscriptPreflightIssue[] = [];
  const assetMap = new Map(input.assets.map((asset) => [asset.id, asset]));
  const orderedPages = [...input.pages].sort(
    (left, right) => left.page_number - right.page_number,
  );
  const pageIds = new Set(orderedPages.map((page) => page.id));
  let totalPanelCount = 0;
  let completedPanelCount = 0;

  const addIssue = (issue: CloudManuscriptPreflightIssue) => issues.push(issue);
  if (!input.coverPageId || !pageIds.has(input.coverPageId)) {
    addIssue({
      code: "cover_missing",
      severity: "error",
      message: "表紙ページを設定してください。",
      pageId: null,
      pageNumber: null,
      panelId: null,
    });
  }

  orderedPages.forEach((page, index) => {
    if (page.page_number !== index + 1) {
      addIssue({
        code: "page_order",
        severity: "error",
        message: `ページ番号が連続していません（${page.page_number}ページ）。`,
        pageId: page.id,
        pageNumber: page.page_number,
        panelId: null,
      });
    }
    for (const panel of page.canvas.panels.filter((item) => item.visible)) {
      totalPanelCount += 1;
      const layers = page.canvas.panelLayers.filter(
        (layer) =>
          layer.panelId === panel.id && layer.visible && Boolean(layer.assetId),
      );
      const assetIds = new Set(
        layers
          .map((layer) => layer.assetId)
          .filter((id): id is string => Boolean(id)),
      );
      if (!assetIds.size && panel.imageAssetId) assetIds.add(panel.imageAssetId);
      if (!assetIds.size) {
        addIssue({
          code: "empty_panel",
          severity: "error",
          message: `${page.page_number}ページ「${panel.name}」に画像がありません。`,
          pageId: page.id,
          pageNumber: page.page_number,
          panelId: panel.id,
        });
        continue;
      }
      const missingAsset = [...assetIds].find((id) => !assetMap.has(id));
      if (missingAsset) {
        addIssue({
          code: "missing_asset",
          severity: "error",
          message: `${page.page_number}ページ「${panel.name}」の画像素材を読み込めません。`,
          pageId: page.id,
          pageNumber: page.page_number,
          panelId: panel.id,
        });
        continue;
      }
      completedPanelCount += 1;
      const primaryLayers = layers.filter(
        (layer) =>
          layer.type === "background" || layer.type === "flattened_legacy",
      );
      const primaryIds = primaryLayers.length
        ? primaryLayers.map((layer) => layer.assetId!)
        : panel.imageAssetId
          ? [panel.imageAssetId]
          : [];
      const lowResolution = primaryIds.some((id) => {
        const asset = assetMap.get(id)!;
        return asset.width < panel.width * 0.75 || asset.height < panel.height * 0.75;
      });
      if (lowResolution) {
        addIssue({
          code: "low_resolution",
          severity: "warning",
          message: `${page.page_number}ページ「${panel.name}」の背景画像は仕上がり解像度が不足する可能性があります。`,
          pageId: page.id,
          pageNumber: page.page_number,
          panelId: panel.id,
        });
      }
    }
    for (const text of textOverflows(page.canvas)) {
      addIssue({
        code: "text_overflow",
        severity: "error",
        message: `${page.page_number}ページ「${text.name}」の文字が枠からはみ出します。`,
        pageId: page.id,
        pageNumber: page.page_number,
        panelId: null,
      });
    }
  });

  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.length - errorCount;
  return {
    ready: errorCount === 0 && orderedPages.length > 0,
    pageCount: orderedPages.length,
    targetPageCount,
    totalPanelCount,
    completedPanelCount,
    errorCount,
    warningCount,
    issues: issues.slice(0, issueLimit),
    truncatedIssueCount: Math.max(0, issues.length - issueLimit),
  };
}
