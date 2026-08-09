import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const errorContracts = [
  [
    "src/app/admin/error.tsx",
    "管理画面を読み込めませんでした",
    'href="/admin"',
  ],
  [
    "src/app/admin/product-updates/error.tsx",
    "更新情報を読み込めませんでした",
    'href="/admin"',
  ],
  [
    "src/app/creator/error.tsx",
    "制作画面を読み込めませんでした",
    'href="/creator"',
  ],
  [
    "src/app/dashboard/error.tsx",
    "ダッシュボードを読み込めませんでした",
    'href="/dashboard/monitor"',
  ],
  [
    "src/app/dashboard/monitor/welcome/error.tsx",
    "画面を読み込めませんでした",
    'href="/dashboard"',
  ],
  [
    "src/app/dashboard/research/error.tsx",
    "市場分析を表示できませんでした",
    'href="/dashboard/research"',
  ],
  [
    "src/app/dashboard/research/[reportId]/proposal/error.tsx",
    "AI企画提案を表示できませんでした",
    'href="/dashboard/research"',
  ],
  [
    "src/app/dashboard/research/[reportId]/proposal/scenario/error.tsx",
    "シナリオを表示できませんでした",
    null,
  ],
  [
    "src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/error.tsx",
    "ネームを表示できませんでした",
    null,
  ],
];

const loadingContracts = [
  ["src/app/dashboard/research/loading.tsx", "市場分析を読み込んでいます"],
  [
    "src/app/dashboard/research/[reportId]/proposal/loading.tsx",
    "AI企画提案を読み込んでいます",
  ],
  [
    "src/app/dashboard/research/[reportId]/proposal/scenario/loading.tsx",
    "シナリオを読み込み中…",
  ],
  [
    "src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/loading.tsx",
    "ネームを読み込み中…",
  ],
];

test("async state primitives preserve page, panel, and action elements", async () => {
  const shell = await read("src/components/AsyncStateShell.tsx");

  assert.match(shell, /<main \{\.\.\.props\} className=\{classNames\("page", className\)\}>/);
  assert.match(shell, /as\?: "div" \| "section"/);
  assert.match(shell, /classNames\("panel", className\)/);
  assert.match(shell, /classNames\("flex", className\)/);
  assert.doesNotMatch(shell, /useEffect|console\.|reset\(|href=/);
});

test("error boundaries use only the shared visual shell", async () => {
  for (const [path, title, href] of errorContracts) {
    const source = await read(path);
    assert.match(source, /@\/components\/AsyncStateShell/, path);
    assert.match(source, /AsyncStatePage/, path);
    assert.match(source, /AsyncStatePanel/, path);
    assert.doesNotMatch(source, /<main\s+className="page/, path);
    assert.doesNotMatch(source, /<(?:section|div)\s+className="panel/, path);
    assert.ok(source.includes(title), `${path}: ${title}`);
    assert.match(source, /onClick=\{reset\}/, path);
    if (href) assert.ok(source.includes(href), `${path}: ${href}`);
  }
});

test("error boundaries retain their existing alert and logging ownership", async () => {
  for (const path of [
    "src/app/creator/error.tsx",
    "src/app/dashboard/error.tsx",
    "src/app/dashboard/monitor/welcome/error.tsx",
    "src/app/dashboard/research/error.tsx",
    "src/app/dashboard/research/[reportId]/proposal/error.tsx",
  ]) {
    assert.match(await read(path), /role="alert"/, path);
  }

  for (const [path, context] of [
    ["src/app/admin/error.tsx", "[admin] render failure"],
    [
      "src/app/admin/product-updates/error.tsx",
      "[admin/product-updates] render failed",
    ],
    ["src/app/creator/error.tsx", "[creator] render failure"],
  ]) {
    const source = await read(path);
    assert.match(source, /useEffect/, path);
    assert.ok(source.includes(context), `${path}: ${context}`);
  }
});

test("loading boundaries retain labels and accessibility contracts", async () => {
  for (const [path, label] of loadingContracts) {
    const source = await read(path);
    assert.match(source, /@\/components\/AsyncStateShell/, path);
    assert.match(source, /AsyncStatePage/, path);
    assert.match(source, /aria-busy="true"/, path);
    assert.ok(source.includes(label), `${path}: ${label}`);
    assert.doesNotMatch(source, /<main\s+className="page/, path);
  }

  for (const path of loadingContracts.slice(0, 2).map(([path]) => path)) {
    const source = await read(path);
    assert.match(source, /aria-live="polite"/, path);
    assert.match(source, /role="status"/, path);
    assert.match(source, /LoaderCircle/, path);
  }

  for (const path of loadingContracts.slice(2).map(([path]) => path)) {
    const source = await read(path);
    assert.match(source, /animate-pulse/, path);
    assert.match(source, /as="div"/, path);
  }
});
