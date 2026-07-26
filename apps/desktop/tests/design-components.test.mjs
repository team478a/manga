import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(here, "..", "src", "renderer");
const commonDir = path.join(rendererDir, "components", "common");

const stylesSource = fs.readFileSync(
  path.join(rendererDir, "styles.css"),
  "utf8",
);
const buttonSource = fs.readFileSync(
  path.join(commonDir, "Button.tsx"),
  "utf8",
);
const cardSource = fs.readFileSync(path.join(commonDir, "Card.tsx"), "utf8");
const formFieldSource = fs.readFileSync(
  path.join(commonDir, "FormField.tsx"),
  "utf8",
);
const floatingToolbarSource = fs.readFileSync(
  path.join(commonDir, "FloatingToolbar.tsx"),
  "utf8",
);
const statusBadgeSource = fs.readFileSync(
  path.join(commonDir, "StatusBadge.tsx"),
  "utf8",
);

function listTsxFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(full);
    return entry.name.endsWith(".tsx") ? [full] : [];
  });
}

test("Button: 4 variantと3サイズがDESKTOP_CREATIVE_STUDIO_SPEC.md §3.1通りに定義されている", () => {
  for (const variant of ["primary", "secondary", "ghost", "danger"]) {
    assert.match(buttonSource, new RegExp(`"${variant}"`));
  }
  for (const size of ["sm", "md", "lg"]) {
    assert.match(buttonSource, new RegExp(`"${size}"`));
  }
});

test("Button: フォーカスリングとdisabled状態を持つ", () => {
  assert.match(stylesSource, /\.ds-button:focus-visible\s*\{[^}]*--focus-ring/);
  assert.match(stylesSource, /\.ds-button:disabled/);
});

test("Button: variantごとの配色が既存トークンを参照している", () => {
  assert.match(stylesSource, /\.ds-button-primary\s*\{[^}]*var\(--accent\)/);
  assert.match(
    stylesSource,
    /\.ds-button-primary:not\(:disabled\):active\s*\{[^}]*var\(--accent-active\)/,
  );
  assert.match(
    stylesSource,
    /\.ds-button-danger\s*\{[^}]*var\(--danger\)/,
  );
});

test("Card: static/interactive variantとdensityを持つ", () => {
  assert.match(cardSource, /"static"/);
  assert.match(cardSource, /"interactive"/);
  assert.match(cardSource, /"standard"/);
  assert.match(cardSource, /"compact"/);
});

test("Card: interactiveはEnterキーでも開ける（role/tabIndex/キーボード処理）", () => {
  assert.match(cardSource, /role=\{interactive \? "button"/);
  assert.match(cardSource, /tabIndex=\{interactive \? 0/);
  assert.match(cardSource, /event\.key === "Enter"/);
});

test("FormField: label/error/hint/required/densityを持つ", () => {
  for (const prop of ["label", "error", "hint", "required", "density"]) {
    assert.match(formFieldSource, new RegExp(prop));
  }
  assert.match(formFieldSource, /role="alert"/);
});

test("FloatingToolbar: role=toolbarとglassトークンのみを使用する（常設UI用の不透明トークンではない）", () => {
  assert.match(floatingToolbarSource, /role="toolbar"/);
  assert.match(
    stylesSource,
    /\.ds-floating-toolbar\s*\{[^}]*var\(--bg-glass\)[^}]*var\(--glass-blur\)/s,
  );
});

test("FloatingToolbar: forced-colors時はグラスを無効化し不透明背景へフォールバックする", () => {
  assert.match(
    stylesSource,
    /@media \(forced-colors: active\)\s*\{[^]*?\.ds-floating-toolbar\s*\{[^}]*var\(--bg-panel\)[^}]*backdrop-filter:\s*none/,
  );
});

test("StatusBadge: activity propが追加され、既存のtone 5種類は変更されていない", () => {
  assert.match(
    statusBadgeSource,
    /StatusTone = "neutral" \| "info" \| "success" \| "warning" \| "danger"/,
  );
  assert.match(statusBadgeSource, /StatusActivity = "running"/);
  assert.match(statusBadgeSource, /activity\?:\s*StatusActivity/);
});

test("StatusBadge: activity=runningの脈動はreduced-motionの既存グローバルルールでフォールバックされる", () => {
  assert.match(
    stylesSource,
    /\.status-badge-activity-running \.status-badge-dot\s*\{[^}]*animation:/,
  );
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)/);
});

test("新規コンポーネントはPhase D2時点でどの既存画面からもimportされていない（単体実装のみ）", () => {
  const screenFiles = listTsxFiles(rendererDir).filter(
    (file) => !file.startsWith(commonDir),
  );
  const newComponentNames = [
    "common/Button",
    "common/Card",
    "common/FormField",
    "common/FloatingToolbar",
  ];
  for (const file of screenFiles) {
    const source = fs.readFileSync(file, "utf8");
    for (const name of newComponentNames) {
      assert.equal(
        source.includes(name),
        false,
        `${path.relative(rendererDir, file)} should not yet import ${name} (Phase D2 is component-only)`,
      );
    }
  }
});

test("既存24トークン・Phase D1トークンはPhase D2で変更されていない", () => {
  assert.match(stylesSource, /--bg-app:\s*#101218;/);
  assert.match(stylesSource, /--accent:\s*#6848d8;/);
  assert.match(stylesSource, /--bg-glass:\s*rgb\(23 26 33 \/ 72%\);/);
  assert.match(stylesSource, /--space-4:\s*16px;/);
});
