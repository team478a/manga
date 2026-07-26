import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const stylesPath = path.join(here, "..", "src", "renderer", "styles.css");
const stylesSource = fs.readFileSync(stylesPath, "utf8");

function rootBlock(source) {
  const match = source.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(match, ":root block not found in styles.css");
  return match[1];
}

const root = rootBlock(stylesSource);

function tokenValue(name) {
  const match = root.match(
    new RegExp(`--${name}:\\s*([^;]+);`),
  );
  return match ? match[1].trim() : null;
}

test("既存24トークンはPhase D1で維持されている", () => {
  const existing = {
    "bg-app": "#101218",
    "bg-panel": "#171a21",
    "bg-panel-elevated": "#1d212a",
    "bg-hover": "#242936",
    "bg-selected": "#2b2650",
    "border-subtle": "#2a303c",
    "border-strong": "#3a4352",
    "text-primary": "#f3f5f7",
    "text-secondary": "#a6afbd",
    "text-muted": "#818b99",
    accent: "#6848d8",
    "accent-hover": "#7354e6",
    "accent-text": "#9b86ff",
    success: "#37c77a",
    warning: "#f0a548",
    danger: "#ed6170",
    info: "#58a6ff",
    "canvas-workspace": "#262a32",
    "canvas-page": "#fff",
  };
  for (const [name, value] of Object.entries(existing)) {
    assert.equal(
      tokenValue(name),
      value,
      `--${name} should keep its Phase D0 value`,
    );
  }
});

test("Elevation/GlassトークンがDESKTOP_CREATIVE_STUDIO_SPEC.md通りに追加されている", () => {
  assert.equal(tokenValue("bg-raised"), "#242936");
  assert.equal(tokenValue("bg-glass"), "rgb(23 26 33 / 72%)");
  assert.equal(tokenValue("glass-bg"), "rgb(23 26 33 / 72%)");
  assert.equal(tokenValue("glass-blur"), "20px");
  assert.equal(tokenValue("glass-border"), "rgb(243 245 247 / 8%)");
  assert.equal(tokenValue("glass-shadow"), "var(--shadow-dialog)");
});

test("Accentトークンにaccent-activeが追加されている", () => {
  assert.equal(tokenValue("accent-active"), "#5638c2");
});

test("Spacingスケールが4pxグリッドで追加されている", () => {
  assert.equal(tokenValue("space-1"), "4px");
  assert.equal(tokenValue("space-2"), "8px");
  assert.equal(tokenValue("space-3"), "12px");
  assert.equal(tokenValue("space-4"), "16px");
  assert.equal(tokenValue("space-5"), "20px");
  assert.equal(tokenValue("space-6"), "24px");
  assert.equal(tokenValue("space-8"), "32px");
  assert.equal(tokenValue("space-10"), "40px");
  assert.equal(tokenValue("space-12"), "48px");
  assert.equal(tokenValue("space-16"), "64px");
});

test("Typographyスケールが追加されている", () => {
  assert.equal(tokenValue("text-2xs"), "11px");
  assert.equal(tokenValue("text-xs"), "12px");
  assert.equal(tokenValue("text-sm"), "13px");
  assert.equal(tokenValue("text-base"), "14px");
  assert.equal(tokenValue("text-md"), "15px");
  assert.equal(tokenValue("text-lg"), "18px");
  assert.equal(tokenValue("text-xl"), "20px");
  assert.equal(tokenValue("text-2xl"), "24px");
});

test("Radiusスケールが追加されている", () => {
  assert.equal(tokenValue("radius-xs"), "4px");
  assert.equal(tokenValue("radius-sm"), "6px");
  assert.equal(tokenValue("radius-md"), "8px");
  assert.equal(tokenValue("radius-lg"), "12px");
  assert.equal(tokenValue("radius-pill"), "999px");
});

test("Motionトークンが追加されている", () => {
  assert.equal(tokenValue("motion-fast"), "120ms");
  assert.equal(tokenValue("motion-base"), "180ms");
  assert.equal(tokenValue("motion-slow"), "240ms");
  assert.equal(tokenValue("ease-standard"), "cubic-bezier(0.2, 0, 0, 1)");
});

test("Layout定数が追加されている", () => {
  assert.equal(tokenValue("rail-width"), "56px");
  assert.equal(tokenValue("topbar-height"), "48px");
  assert.equal(tokenValue("statusbar-height"), "28px");
});

test("既存セレクタ・レイアウトクラスはPhase D1で変更されていない", () => {
  assert.match(stylesSource, /\.skip-link\s*\{/);
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(stylesSource, /@media \(forced-colors: active\)/);
});

test("新しいglass系トークンは常設UIセレクタへまだ適用されていない", () => {
  const glassUsageOutsideRoot = stylesSource
    .split("\n")
    .filter((line) => !root.includes(line))
    .some((line) => /var\(--(bg-glass|glass-)/.test(line));
  assert.equal(
    glassUsageOutsideRoot,
    false,
    "Phase D1 must only define glass tokens, not apply them to selectors yet",
  );
});
