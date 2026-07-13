import type { PageSize, Rect } from "./types.js";
export type PageTemplateId =
  | "single"
  | "vertical_two"
  | "horizontal_two"
  | "top_one_bottom_two"
  | "four_equal"
  | "six_equal";
export type PageTemplate = { id: PageTemplateId; name: string; panels: Rect[] };
export const pageTemplates: readonly PageTemplate[] = [
  {
    id: "single",
    name: "1コマ全面",
    panels: [{ x: 0, y: 0, width: 1, height: 1 }],
  },
  {
    id: "vertical_two",
    name: "縦2分割",
    panels: [
      { x: 0, y: 0, width: 0.5, height: 1 },
      { x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    id: "horizontal_two",
    name: "横2分割",
    panels: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    id: "top_one_bottom_two",
    name: "上1コマ＋下2コマ",
    panels: [
      { x: 0, y: 0, width: 1, height: 0.5 },
      { x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  { id: "four_equal", name: "4コマ均等", panels: grid(2, 2) },
  { id: "six_equal", name: "6コマ均等", panels: grid(2, 3) },
] as const;
export function applyPageTemplate(
  id: PageTemplateId,
  page: PageSize,
  options: { marginRatio?: number; gapRatio?: number } = {},
) {
  const template = pageTemplates.find((value) => value.id === id);
  if (!template) throw new Error("ページテンプレートが見つかりません。");
  const marginRatio = options.marginRatio ?? 0.03,
    gapRatio = options.gapRatio ?? 0.015,
    innerWidth = page.width * (1 - marginRatio * 2),
    innerHeight = page.height * (1 - marginRatio * 2),
    gap = Math.min(page.width, page.height) * gapRatio;
  return template.panels.map((panel) => ({
    x:
      page.width * marginRatio +
      panel.x * innerWidth +
      (panel.x > 0 ? gap / 2 : 0),
    y:
      page.height * marginRatio +
      panel.y * innerHeight +
      (panel.y > 0 ? gap / 2 : 0),
    width: Math.max(
      1,
      panel.width * innerWidth - (panel.width < 1 ? gap / 2 : 0),
    ),
    height: Math.max(
      1,
      panel.height * innerHeight - (panel.height < 1 ? gap / 2 : 0),
    ),
  }));
}
function grid(columns: number, rows: number) {
  const result: Rect[] = [];
  for (let row = 0; row < rows; row++)
    for (let column = 0; column < columns; column++)
      result.push({
        x: column / columns,
        y: row / rows,
        width: 1 / columns,
        height: 1 / rows,
      });
  return result;
}
