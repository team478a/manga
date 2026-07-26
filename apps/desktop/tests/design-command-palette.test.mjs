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
const paletteSource = fs.readFileSync(
  path.join(commonDir, "CommandPalette.tsx"),
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

test("CommandPalette: role=dialog + aria-modal、結果はrole=listbox/optionを持つ", () => {
  assert.match(paletteSource, /role="dialog"/);
  assert.match(paletteSource, /aria-modal="true"/);
  assert.match(paletteSource, /role="listbox"/);
  assert.match(paletteSource, /role="option"/);
});

test("CommandPalette: ArrowUp/ArrowDown/Enter/Escapeのキーボード操作を持つ", () => {
  assert.match(paletteSource, /"ArrowDown"/);
  assert.match(paletteSource, /"ArrowUp"/);
  assert.match(paletteSource, /"Enter"/);
  assert.match(paletteSource, /"Escape"/);
});

test("CommandPalette: 開いた瞬間に検索入力へフォーカスし、閉じたら呼び出し元へ復帰する", () => {
  assert.match(paletteSource, /inputRef\.current\?\.focus\(\)/);
  assert.match(paletteSource, /previouslyFocused\.current\?\.focus\?\.\(\)/);
});

test("CommandPalette: 結果件数の変化をaria-live=politeで通知する（視覚的には非表示）", () => {
  assert.match(paletteSource, /aria-live="polite"/);
  assert.match(paletteSource, /ds-visually-hidden/);
});

test("CommandPalette: Providerの有効/無効を即時切り替えるAPIを持たない（安全境界）", () => {
  const forbiddenPatterns = [
    /enableProvider/i,
    /toggleProvider/i,
    /setProviderEnabled/i,
    /provider.*enabled\s*=\s*true/i,
  ];
  for (const pattern of forbiddenPatterns) {
    assert.equal(
      pattern.test(paletteSource),
      false,
      `CommandPalette.tsx must not expose a way to toggle providers directly (matched ${pattern})`,
    );
  }
  // CommandItem's only action hook is onSelect, a caller-supplied callback;
  // the component itself carries no provider-specific behavior.
  assert.match(paletteSource, /onSelect: \(\) => void/);
});

test("CommandPalette: glassトークンを使用し、一時UIとしてforced-colorsフォールバックを持つ", () => {
  assert.match(
    stylesSource,
    /\.ds-command-palette\s*\{[^}]*var\(--bg-glass\)[^}]*var\(--glass-blur\)/s,
  );
  assert.match(
    stylesSource,
    /@media \(forced-colors: active\)\s*\{[^]*?\.ds-command-palette\s*\{[^}]*var\(--bg-panel\)[^}]*backdrop-filter:\s*none/,
  );
});

test("CommandPaletteはPhase D3（本フェーズ）時点でどの既存画面からもimportされていない（単体実装のみ）", () => {
  const screenFiles = listTsxFiles(rendererDir).filter(
    (file) => !file.startsWith(commonDir),
  );
  for (const file of screenFiles) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(
      source.includes("common/CommandPalette"),
      false,
      `${path.relative(rendererDir, file)} should not yet import CommandPalette (global Ctrl+K wiring is out of scope for this phase)`,
    );
  }
});
