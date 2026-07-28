import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isValidHomeProject,
  filterHomeProjects,
  sortHomeProjects,
  buildHomeProjectView,
} from "../src/renderer/features/home/project-view-model.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.join(here, "..", "src", "renderer");
const mainSource = fs.readFileSync(path.join(rendererDir, "main.tsx"), "utf8");
const stylesSource = fs.readFileSync(
  path.join(rendererDir, "styles.css"),
  "utf8",
);
const homeProjectCardSource = fs.readFileSync(
  path.join(rendererDir, "components", "home", "HomeProjectCard.tsx"),
  "utf8",
);
const homeProjectGridSource = fs.readFileSync(
  path.join(rendererDir, "components", "home", "HomeProjectGrid.tsx"),
  "utf8",
);
const homeProjectFiltersSource = fs.readFileSync(
  path.join(rendererDir, "components", "home", "HomeProjectFilters.tsx"),
  "utf8",
);
const viewModelSource = fs.readFileSync(
  path.join(rendererDir, "features", "home", "project-view-model.ts"),
  "utf8",
);

function project(overrides = {}) {
  return {
    id: "p1",
    title: "Project 1",
    subtitle: "",
    description: "",
    genre: "",
    ageRating: "全年齢",
    contentClass: "general",
    readingDirection: "rtl",
    width: 2000,
    height: 3000,
    dpi: 350,
    storagePath: "/tmp/p1",
    coverAssetId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastOpenedAt: null,
    ...overrides,
  };
}

test("isValidHomeProject: idまたはtitleを欠くProjectを除外する", () => {
  assert.equal(isValidHomeProject(project()), true);
  assert.equal(isValidHomeProject(project({ id: "" })), false);
  assert.equal(isValidHomeProject(project({ title: "" })), false);
  assert.equal(isValidHomeProject(null), false);
  assert.equal(isValidHomeProject(undefined), false);
});

test("filterHomeProjects: 不正なProjectレコードで画面全体をクラッシュさせず除外する", () => {
  const projects = [
    project({ id: "a" }),
    { id: "", title: "" },
    null,
    project({ id: "b" }),
  ];
  const result = filterHomeProjects(projects, "all");
  assert.deepEqual(
    result.map((p) => p.id),
    ["a", "b"],
  );
});

test("filterHomeProjects: 一般／成人向けの表示分岐", () => {
  const projects = [
    project({ id: "g1", contentClass: "general" }),
    project({ id: "a1", contentClass: "adult" }),
    project({ id: "g2", contentClass: "general" }),
  ];
  assert.deepEqual(
    filterHomeProjects(projects, "general").map((p) => p.id),
    ["g1", "g2"],
  );
  assert.deepEqual(
    filterHomeProjects(projects, "adult").map((p) => p.id),
    ["a1"],
  );
  assert.equal(filterHomeProjects(projects, "all").length, 3);
});

test("sortHomeProjects: 更新日時の新しい順に並ぶ", () => {
  const projects = [
    project({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
    project({ id: "new", updatedAt: "2026-02-01T00:00:00.000Z" }),
    project({ id: "mid", updatedAt: "2026-01-15T00:00:00.000Z" }),
  ];
  assert.deepEqual(
    sortHomeProjects(projects, "recent").map((p) => p.id),
    ["new", "mid", "old"],
  );
});

test("sortHomeProjects: タイトル順（辞書順）に並ぶ", () => {
  const projects = [
    project({ id: "c", title: "charlie" }),
    project({ id: "a", title: "alpha" }),
    project({ id: "b", title: "bravo" }),
  ];
  assert.deepEqual(
    sortHomeProjects(projects, "title").map((p) => p.id),
    ["a", "b", "c"],
  );
});

test("sortHomeProjects: 元の配列を変更しない（副作用なし）", () => {
  const projects = [
    project({ id: "b", title: "b" }),
    project({ id: "a", title: "a" }),
  ];
  const original = projects.slice();
  sortHomeProjects(projects, "title");
  assert.deepEqual(
    projects.map((p) => p.id),
    original.map((p) => p.id),
  );
});

test("buildHomeProjectView: filterとsortを組み合わせて適用する", () => {
  const projects = [
    project({ id: "g-new", contentClass: "general", updatedAt: "2026-02-01T00:00:00.000Z" }),
    project({ id: "a-new", contentClass: "adult", updatedAt: "2026-03-01T00:00:00.000Z" }),
    project({ id: "g-old", contentClass: "general", updatedAt: "2026-01-01T00:00:00.000Z" }),
  ];
  const view = buildHomeProjectView(projects, { filter: "general", sort: "recent" });
  assert.deepEqual(
    view.map((p) => p.id),
    ["g-new", "g-old"],
  );
});

test("buildHomeProjectView: Projectが0件の場合は空配列を返す（Empty State判定に使う）", () => {
  assert.deepEqual(buildHomeProjectView([], { filter: "all", sort: "recent" }), []);
});

test("project-view-model.ts: Provider有効化・成人向け生成・APIキー・課金・IPC呼び出しを一切含まない（純粋な表示ロジックのみ）", () => {
  const forbiddenPattern =
    /window\.mangai|ipcRenderer|provider.*有効化|apiKey|apiキー|stripe|checkout|課金/i;
  assert.doesNotMatch(viewModelSource, forbiddenPattern);
});

test("HomeProjectGrid: Projectが0件のときEmpty Stateを表示する", () => {
  assert.match(homeProjectGridSource, /t\("home\.none"\)/);
  assert.match(homeProjectGridSource, /t\("home\.filteredNone"\)/);
});

test("HomeProjectGrid: auto-fillグリッドを使用し、固定列数を指定していない。カード最大幅は280pxに制限されている（責任者レビュー指摘: 1件時の過度な拡大防止）", () => {
  assert.match(
    stylesSource,
    /\.home-project-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(240px,\s*280px\)\)/s,
  );
  assert.match(stylesSource, /\.home-project-grid\s*\{[^}]*justify-content:\s*start/s);
  assert.doesNotMatch(stylesSource, /\.home-project-grid[^}]*grid-template-columns:\s*repeat\(\d/s);
  assert.doesNotMatch(stylesSource, /\.home-project-grid[^}]*minmax\(240px,\s*1fr\)/s);
});

test("HomeProjectCard: 一般Projectのみ成人向け移行ボタンを表示する", () => {
  assert.match(homeProjectCardSource, /contentClass === "general" &&/);
  assert.match(homeProjectCardSource, /onMoveAdult/);
});

test("HomeProjectCard: バックアップ・複製・削除の既存処理を維持している", () => {
  assert.match(homeProjectCardSource, /onBackup/);
  assert.match(homeProjectCardSource, /onDuplicate/);
  assert.match(homeProjectCardSource, /onDelete/);
});

test("HomeProjectCard: Projectを開くボタンのaria-labelを維持している", () => {
  assert.match(homeProjectCardSource, /aria-label=\{t\("home\.openProject", \{ title: project\.title \}\)\}/);
});

test("HomeProjectCard: 削除ボタンはhover専用のCSS（visibility/opacity:0のhover限定表示）に依存していない", () => {
  assert.doesNotMatch(
    stylesSource,
    /\.home-project-card-actions\s*\{[^}]*(opacity:\s*0|visibility:\s*hidden)/s,
  );
  assert.doesNotMatch(
    stylesSource,
    /\.home-project-card:hover\s+\.home-project-card-actions/,
  );
});

test("HomeProjectCard: Project IDや保存パスをラベルとして表示していない", () => {
  assert.doesNotMatch(homeProjectCardSource, />\{project\.id\}</);
  assert.doesNotMatch(homeProjectCardSource, />\{project\.storagePath\}</);
});

test("HomeProjectFilters: フィルタ操作にaria-pressedでボタン状態を通知する", () => {
  assert.match(homeProjectFiltersSource, /aria-pressed=\{value === filter\}/);
});

test("HomeProjectFilters: フィルタ・並び替えはキーボード操作可能なネイティブbutton/selectを使用する", () => {
  assert.match(homeProjectFiltersSource, /<button/);
  assert.match(homeProjectFiltersSource, /<select/);
});

test("main.tsx: HomeProjectGrid/HomeProjectFiltersをHome画面へ配線している", () => {
  assert.match(mainSource, /import \{ HomeProjectGrid \} from "\.\/components\/home\/HomeProjectGrid";/);
  assert.match(mainSource, /import \{ HomeProjectFilters \} from "\.\/components\/home\/HomeProjectFilters";/);
  assert.match(mainSource, /<HomeProjectGrid/);
});

test("main.tsx: Home画面のコマンドパレット配線（Phase D3-B）はPhase D3-Cで維持されている", () => {
  assert.match(mainSource, /\{commandPaletteElement\}/);
  assert.match(mainSource, /toggleCommandPalette/);
});

test("main.tsx: Project一覧のフィルタ・並び替えstateはHome画面にのみ影響し、bundle/activeTool等の既存状態管理を再定義していない", () => {
  assert.match(mainSource, /homeProjectFilter, setHomeProjectFilter/);
  assert.match(mainSource, /homeProjectSort, setHomeProjectSort/);
  assert.doesNotMatch(mainSource, /const \[bundle, setBundle\]\s*=\s*React\.useState<ProjectBundle \| null>\(null\),\s*\n\s*\[homeProjectFilter/);
});

test("ブレークポイント: Home画面カードグリッドは新規メディアクエリを追加していない（DESKTOP_CREATIVE_STUDIO_SPEC.md §5は未承認のため対象外。BrowserWindowのminWidth=1100pxにより899px以下は到達不可能だった）", () => {
  assert.doesNotMatch(stylesSource, /@media \(max-width: 899px\)/);
  const mainIndexSource = fs.readFileSync(
    path.join(here, "..", "src", "main", "index.ts"),
    "utf8",
  );
  assert.match(mainIndexSource, /minWidth:\s*1100/);
});

test("安全境界: AI Provider有効化・成人向け生成の直接実行・APIキー変更・課金操作のコマンドが新規コンポーネントに存在しない", () => {
  const forbiddenPattern =
    /provider.*有効化|成人向け.*(生成|実行)|api\s*key|apiキー|stripe|checkout|課金/i;
  for (const source of [
    homeProjectCardSource,
    homeProjectGridSource,
    homeProjectFiltersSource,
    viewModelSource,
  ]) {
    assert.doesNotMatch(source, forbiddenPattern);
  }
});

test("新規npm依存パッケージが追加されていない（apps/desktop）", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(here, "..", "package.json"), "utf8"),
  );
  const dependencyNames = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ];
  for (const forbidden of ["playwright", "spectron", "webdriverio", "tailwindcss"]) {
    assert.equal(
      dependencyNames.includes(forbidden),
      false,
      `${forbidden} should not be a new dependency`,
    );
  }
});
