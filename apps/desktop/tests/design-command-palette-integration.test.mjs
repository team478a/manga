import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  shouldOpenCommandPalette,
} from "../src/renderer/features/command-palette/use-command-palette.ts";
import {
  buildCommandSections,
} from "../src/renderer/features/command-palette/command-palette-items.ts";
import {
  getRecentProjects,
} from "../src/renderer/features/command-palette/recent-project-commands.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(here, "..", "src", "renderer");
const mainSource = fs.readFileSync(path.join(rendererDir, "main.tsx"), "utf8");
const i18nSource = fs.readFileSync(path.join(rendererDir, "i18n.tsx"), "utf8");
const appHeaderSource = fs.readFileSync(
  path.join(rendererDir, "components", "app-shell", "AppHeader.tsx"),
  "utf8",
);
const commandPaletteSource = fs.readFileSync(
  path.join(
    rendererDir,
    "components",
    "common",
    "CommandPalette.tsx",
  ),
  "utf8",
);
const itemsSource = fs.readFileSync(
  path.join(
    rendererDir,
    "features",
    "command-palette",
    "command-palette-items.ts",
  ),
  "utf8",
);
const recentProjectsSource = fs.readFileSync(
  path.join(
    rendererDir,
    "features",
    "command-palette",
    "recent-project-commands.ts",
  ),
  "utf8",
);
const useCommandPaletteSource = fs.readFileSync(
  path.join(
    rendererDir,
    "features",
    "command-palette",
    "use-command-palette.ts",
  ),
  "utf8",
);
const rootPackageJsonPath = path.join(here, "..", "package.json");
const packageJson = JSON.parse(fs.readFileSync(rootPackageJsonPath, "utf8"));

function baseEvent(overrides = {}) {
  return {
    key: "k",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  };
}

// --- 1: Ctrl+Kのショートカット登録 ---
test("Ctrl+Kでコマンドパレットが開くと判定される", () => {
  assert.equal(shouldOpenCommandPalette(baseEvent({ ctrlKey: true })), true);
});

// --- 2: Meta+Kのショートカット登録 ---
test("Meta+Kでコマンドパレットが開くと判定される（macOS互換）", () => {
  assert.equal(shouldOpenCommandPalette(baseEvent({ metaKey: true })), true);
});

// --- 3: IME変換中は起動しない ---
test("IME変換中（isComposing）はCtrl+Kでも起動しないと判定される", () => {
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true, isComposing: true })),
    false,
  );
});

test("disabled指定中は起動しないと判定される（モーダル操作中のガード）", () => {
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true }), { disabled: true }),
    false,
  );
});

test("Alt併用やCtrl+Meta同時押しなど想定外の修飾キー組み合わせでは起動しない", () => {
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true, altKey: true })),
    false,
  );
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true, shiftKey: true })),
    false,
  );
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true, metaKey: true })),
    false,
  );
});

test("K以外のキーでは起動しないと判定される", () => {
  assert.equal(
    shouldOpenCommandPalette(baseEvent({ ctrlKey: true, key: "p" })),
    false,
  );
});

// --- 4: Escapeで閉じる（CommandPalette本体、Phase D3実装を維持） ---
test("CommandPalette: Escapeで閉じる実装を維持している", () => {
  assert.match(commandPaletteSource, /"Escape"/);
});

// --- 5: 上部バートリガーから開く（起動ボタン再操作で閉じるトグル契約を含む） ---
test("Home画面の上部バーにコマンドパレットトリガーが存在し、再操作でトグルする", () => {
  assert.match(mainSource, /onClick=\{toggleCommandPalette\}/);
  assert.match(mainSource, /aria-label=\{t\("home\.commandPaletteLabel"\)\}/);
  assert.match(mainSource, /\{t\("home\.commandPalette"\)\}/);
});

test("Home画面のコマンド・最終確認・自動バックアップ結果は日英表示へ対応する", () => {
  assert.match(mainSource, /t\("home\.lastChecked"/);
  assert.match(i18nSource, /"home\.commandPaletteLabel": "Open command palette \(Ctrl\+K\)"/);
  assert.match(i18nSource, /"home\.lastChecked": "Last checked \{value\}"/);
  assert.match(i18nSource, /All projects are already backed up\./);
  assert.match(i18nSource, /Created \$1 automatic backups\./);
  assert.match(i18nSource, /\$1 projects could not be backed up\./);
});

test("AppHeader（制作ワークスペース上部バー）にコマンドパレットトリガーが配線されている", () => {
  assert.match(appHeaderSource, /onToggleCommandPalette/);
  assert.match(mainSource, /onToggleCommandPalette=\{toggleCommandPalette\}/);
});

test("useCommandPalette: togglePaletteが開閉状態を反転させる契約を持つ", () => {
  assert.match(useCommandPaletteSource, /togglePalette:\s*\(\)\s*=>\s*setOpen/);
});

// --- 6/7: 移動コマンド ---
test("移動セクション: Home移動コマンドが存在する", () => {
  const sections = buildCommandSections(contextFor({ hasActiveProject: false }));
  const navigation = sections.find((s) => s.id === "navigation");
  assert.ok(navigation, "navigation section should exist");
  assert.ok(navigation.items.some((item) => item.id === "nav-home"));
});

test("移動セクション: 設定移動コマンドはProjectが開いている時だけ存在する", () => {
  const withProject = buildCommandSections(
    contextFor({ hasActiveProject: true }),
  );
  const navWith = withProject.find((s) => s.id === "navigation");
  assert.ok(navWith.items.some((item) => item.id === "nav-settings"));

  const withoutProject = buildCommandSections(
    contextFor({ hasActiveProject: false }),
  );
  const navWithout = withoutProject.find((s) => s.id === "navigation");
  assert.equal(
    (navWithout?.items ?? []).some((item) => item.id === "nav-settings"),
    false,
    "settings navigation must not be offered when no screen can show it",
  );
});

// --- 8: 最近開いたProjectが最大件数を超えない ---
test("最近開いたProjectは最大5件で、更新日時の新しい順に並ぶ", () => {
  const projects = Array.from({ length: 8 }, (_, i) => ({
    id: `p${i}`,
    title: `Project ${i}`,
    updatedAt: new Date(2026, 0, i + 1).toISOString(),
  }));
  const recent = getRecentProjects(projects);
  assert.equal(recent.length, 5);
  assert.equal(recent[0].id, "p7");
  assert.equal(recent[4].id, "p3");
});

test("最近開いたProjectセクションは存在しないProject IDを生成しない", () => {
  const projects = [
    { id: "only-one", title: "Only", updatedAt: new Date().toISOString() },
  ];
  const sections = buildCommandSections(
    contextFor({ hasActiveProject: false, projects }),
  );
  const recent = sections.find((s) => s.id === "recent-projects");
  assert.equal(recent.items.length, 1);
  assert.equal(recent.items[0].id, "recent-only-one");
});

// --- 10: 無効なProjectを除外する ---
test("id・titleを欠く無効なProjectレコードは最近開いたProjectから除外される", () => {
  const projects = [
    { id: "valid-1", title: "有効なProject", updatedAt: new Date(2026, 0, 5).toISOString() },
    { id: "", title: "IDなし", updatedAt: new Date(2026, 0, 6).toISOString() },
    { id: "valid-2", title: "", updatedAt: new Date(2026, 0, 7).toISOString() },
    { id: "valid-3", title: "有効なProject2", updatedAt: new Date(2026, 0, 4).toISOString() },
  ];
  const recent = getRecentProjects(projects);
  assert.deepEqual(
    recent.map((p) => p.id).sort(),
    ["valid-1", "valid-3"].sort(),
  );
});

test("Projectが0件の場合、最近開いたProjectセクションはコマンド一覧に含まれない", () => {
  const sections = buildCommandSections(
    contextFor({ hasActiveProject: false, projects: [] }),
  );
  assert.equal(
    sections.some((s) => s.id === "recent-projects"),
    false,
    "empty recent-projects section must be omitted rather than shown empty",
  );
});

// --- 8(Project): 新規Projectコマンドが存在する ---
test("Projectセクション: 新規Project作成コマンドが常に存在する", () => {
  const withProject = buildCommandSections(contextFor({ hasActiveProject: true }));
  const withoutProject = buildCommandSections(contextFor({ hasActiveProject: false }));
  for (const sections of [withProject, withoutProject]) {
    const project = sections.find((s) => s.id === "project");
    assert.ok(project.items.some((item) => item.id === "project-new"));
  }
});

// --- 14: Project削除コマンドが存在しない ---
test("Projectセクション: 削除・成人向け移動・一括削除・初期化コマンドが存在しない", () => {
  const sections = buildCommandSections(contextFor({ hasActiveProject: true }));
  const allIds = sections.flatMap((s) => s.items.map((i) => i.id));
  const allLabels = sections.flatMap((s) => s.items.map((i) => i.label));
  for (const id of allIds) {
    assert.doesNotMatch(id, /delete|remove|adult-move|reset-data/i);
  }
  for (const label of allLabels) {
    assert.doesNotMatch(label, /削除|成人向けへ移動|初期化|一括/);
  }
});

// --- 17: Event listenerがcleanupされる／同じショートカットが重複登録されない ---
test("useCommandPalette: keydownリスナーをuseEffectのcleanupで確実に解除する", () => {
  assert.match(
    useCommandPaletteSource,
    /return \(\) => document\.removeEventListener\("keydown", onKeyDown\);/,
  );
});

test("useCommandPalette: disabled変更時に古いリスナーを解除してから再登録する（多重登録防止）", () => {
  // useEffectの依存配列が [disabled] であること、かつ同一useEffect内で
  // addEventListener/removeEventListenerが対になっていることを確認する。
  // Reactの仕様上、依存変更時は次のeffect実行前に必ず前回のcleanupが
  // 呼ばれるため、これにより同じリスナーの多重登録が起きない。
  assert.match(useCommandPaletteSource, /}, \[disabled\]\);/);
  const addCount = (
    useCommandPaletteSource.match(/document\.addEventListener\("keydown"/g) ?? []
  ).length;
  const removeCount = (
    useCommandPaletteSource.match(/document\.removeEventListener\("keydown"/g) ?? []
  ).length;
  assert.equal(addCount, 1);
  assert.equal(removeCount, 1);
});

// --- 9/10/11: 安全境界（Provider直接有効化・成人向け直接実行・APIキー変更コマンドが存在しない） ---
// コメント（安全境界の説明文そのもの）を誤検出しないよう、コメントを除去した
// 実コードだけを対象に検査する。
test("安全境界: Provider直接有効化・成人向け生成直接実行・APIキー変更のコマンドが存在しない（実コード）", () => {
  const forbiddenPatterns = [
    /enableProvider/i,
    /toggleProvider/i,
    /Provider.*有効化/,
    /成人向け.*(生成|実行)/,
    /adultGeneration/i,
    /apiKey/i,
    /APIキー/,
    /stripe/i,
    /checkout/i,
    /課金/,
  ];
  for (const source of [itemsSource, recentProjectsSource]) {
    const codeOnly = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    for (const pattern of forbiddenPatterns) {
      assert.equal(
        pattern.test(codeOnly),
        false,
        `command-palette feature code must not contain a match for ${pattern}`,
      );
    }
  }
});

test("安全境界: 生成されるコマンドラベルは既存のsetActiveTool(\"settings\")等、設定画面を開くだけの操作に限定されている", () => {
  const sections = buildCommandSections(contextFor({ hasActiveProject: true }));
  const allLabels = sections.flatMap((s) => s.items.map((i) => i.label));
  for (const label of allLabels) {
    assert.doesNotMatch(label, /有効化|無効化|承認を省略|一括削除/);
  }
});

// --- 12: コマンド実行後に閉じる（CommandPalette本体側の既存契約） ---
test("CommandPalette: コマンド実行後にonCloseが呼ばれる実装を維持している", () => {
  assert.match(commandPaletteSource, /item\.onSelect\(\);\s*\n\s*onClose\(\);/);
});

// --- 13: フォーカス復帰の契約が維持される ---
test("CommandPalette: 開いた瞬間に検索入力へフォーカスし、閉じたら呼び出し元へ復帰する契約を維持している", () => {
  assert.match(commandPaletteSource, /inputRef\.current\?\.focus\(\)/);
  assert.match(commandPaletteSource, /previouslyFocused\.current\?\.focus\?\.\(\)/);
});

// --- 14: 新しい依存パッケージが追加されていない ---
test("新規npm依存パッケージが追加されていない", () => {
  const deps = Object.keys(packageJson.dependencies ?? {});
  const devDeps = Object.keys(packageJson.devDependencies ?? {});
  const knownDeps = [
    "@supabase/ssr",
    "@supabase/supabase-js",
    "@stripe/stripe-js",
    "stripe",
  ];
  // ルートpackage.jsonはHub側の依存を含むため、Desktop固有の依存だけを
  // 個別検査するのではなく、依存追加そのものが起きていないことを
  // apps/desktop/package.jsonの方で確認する。
  assert.ok(Array.isArray(deps));
  assert.ok(Array.isArray(devDeps));
});

test("apps/desktop/package.jsonに新規依存パッケージが追加されていない", () => {
  const desktopPackageJson = JSON.parse(
    fs.readFileSync(path.join(here, "..", "package.json"), "utf8"),
  );
  const expectedDependencyNames = [
    "@mangai/ai-core",
    "@mangai/canvas-core",
    "@mangai/export-core",
    "@mangai/project-core",
    "@mangai/shared",
    "@napi-rs/keyring",
    "better-sqlite3",
    "electron-updater",
    "image-size",
    "jszip",
    "konva",
    "lucide-react",
    "pdf-lib",
    "react",
    "react-dom",
    "react-konva",
    "sharp",
    "yauzl",
    "yazl",
    "zod",
  ];
  assert.deepEqual(
    Object.keys(desktopPackageJson.dependencies ?? {}).sort(),
    [...expectedDependencyNames].sort(),
    "apps/desktop/package.json dependencies must not gain new entries for Phase D3-B",
  );
});

function contextFor({ hasActiveProject, projects = [] }) {
  const noop = () => {};
  return {
    hasActiveProject,
    projects,
    formatDateTime: (value) => value,
    actions: {
      goHome: noop,
      goWorkspace: noop,
      goGeneration: noop,
      goSettings: noop,
      goHubStatus: noop,
      openNewProjectDialog: noop,
      openProject: noop,
      backupActiveProject: noop,
      restoreProject: noop,
      checkForUpdate: noop,
    },
  };
}
