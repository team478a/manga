import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("Dashboardは実データを使うSaaS型サマリーを表示する", async () => {
  const dashboard = await source("../src/app/dashboard/page.tsx");

  for (const table of [
    '"works"',
    '"digital_products"',
    '"orders"',
    '"cloud_ai_notifications"',
  ]) {
    assert.match(dashboard, new RegExp(`from\\(${table}\\)`));
  }

  assert.match(dashboard, /管理中の作品/);
  assert.match(dashboard, /最近の作品/);
  assert.match(dashboard, /xl:grid-cols-\[minmax\(0,1\.55fr\)_minmax\(300px,0\.85fr\)\]/);
  assert.doesNotMatch(dashboard, /AI提案スコア|市場分析|先月比|推定\+/);
});

test("Cloud UI-2はブランドtokenとコンパクトなアプリShellを持つ", async () => {
  const [tailwind, header, shell, nav, globals] = await Promise.all([
    source("../tailwind.config.ts"),
    source("../src/components/Header.tsx"),
    source("../src/components/layout/SectionShell.tsx"),
    source("../src/components/layout/SectionNav.tsx"),
    source("../src/app/globals.css"),
  ]);

  assert.match(tailwind, /brand:/);
  assert.match(header, /min-h-\[56px\]/);
  assert.match(header, /bg-brand-600/);
  assert.match(shell, /208px_minmax\(0,1fr\)/);
  assert.match(shell, /bg-brand-50/);
  assert.match(nav, /item\.group/);
  assert.match(nav, /item\.icon/);
  assert.match(globals, /\.button\s*\{[^}]*bg-brand-600/s);
  assert.match(globals, /\.ui-button-primary\s*\{[^}]*bg-brand-600/s);
  assert.doesNotMatch(globals, /\.button\s*\{[^}]*bg-leaf/s);
  assert.doesNotMatch(globals, /\.ui-button-primary\s*\{[^}]*bg-leaf/s);
});

test("Cloud Dashboard刷新計画は変更境界と検証条件を記録する", async () => {
  const plan = await source(
    "../docs/design/CLOUD_DASHBOARD_REDESIGN_PLAN.md",
  );

  assert.match(plan, /Cloud UI-2/);
  assert.match(plan, /実データ/);
  assert.match(plan, /Desktop/);
  assert.match(plan, /レスポンシブ/);
});

test("主要Dashboard管理画面は同じSaaS UI部品へ移行する", async () => {
  for (const relativePath of [
    "../src/app/dashboard/works/page.tsx",
    "../src/app/dashboard/products/page.tsx",
    "../src/app/dashboard/sales/page.tsx",
  ]) {
    const page = await source(relativePath);
    assert.match(page, /PageHeader/);
    assert.match(page, /<Card/);
    assert.match(page, /shadow-app/);
    assert.doesNotMatch(page, /className="panel/);
  }
});

test("主要Creator画面は同じSaaS UI部品とmobile layoutへ移行する", async () => {
  for (const relativePath of [
    "../src/app/creator/new/page.tsx",
    "../src/app/creator/trash/page.tsx",
    "../src/app/creator/[projectId]/page.tsx",
  ]) {
    const page = await source(relativePath);
    assert.match(page, /PageHeader/);
    assert.match(page, /<Card/);
    assert.match(page, /shadow-app/);
    assert.doesNotMatch(page, /className="panel/);
    assert.doesNotMatch(page, /className="button/);
  }

  const project = await source("../src/app/creator/[projectId]/page.tsx");
  assert.match(project, /flex-col gap-2 sm:flex-row/);
  assert.match(project, /flex flex-wrap gap-1/);
  assert.doesNotMatch(project, /bg-green-50|text-leaf/);
});
