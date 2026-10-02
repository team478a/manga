import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Marketplace主要画面は読み込み中を支援技術へ通知する", async () => {
  const [loading, home, works, detail, purchases] = await Promise.all([
    read("src/components/marketplace/MarketplaceLoadingState.tsx"),
    read("src/app/page.tsx"),
    read("src/app/works/loading.tsx"),
    read("src/app/works/[id]/loading.tsx"),
    read("src/app/dashboard/purchases/loading.tsx"),
  ]);

  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /aria-live="polite"/);
  assert.match(loading, /role="status"/);
  assert.match(loading, /motion-reduce:animate-none/);
  assert.match(home, /<Suspense/);
  assert.match(home, /書店を読み込んでいます/);
  assert.match(works, /漫画を読み込んでいます/);
  assert.match(detail, /作品情報を読み込んでいます/);
  assert.match(purchases, /本棚を読み込んでいます/);
});

test("DB読込失敗を空一覧やnot foundとして扱わない", async () => {
  const [home, works, detail] = await Promise.all([
    read("src/app/page.tsx"),
    read("src/app/works/page.tsx"),
    read("src/app/works/[id]/page.tsx"),
  ]);

  assert.match(home, /loadFailed: Boolean\(error\)/);
  assert.match(home, /role=\{loadFailed \? "alert" : undefined\}/);
  assert.match(works, /error: worksError/);
  assert.match(works, /error: tagsError/);
  assert.match(works, /if \(worksError \|\| tagsError\)/);
  assert.match(detail, /if \(workError\) throw new Error\("marketplace_work_load_failed"\)/);
  assert.match(detail, /if \(productsError\) throw new Error\("marketplace_products_load_failed"\)/);
  assert.ok(detail.indexOf("if (workError)") < detail.indexOf("if (!work) notFound()"));
});

test("作品・本棚は再試行可能なerrorと作品not found表示を持つ", async () => {
  const [worksError, purchaseError, notFound] = await Promise.all([
    read("src/app/works/error.tsx"),
    read("src/app/dashboard/purchases/error.tsx"),
    read("src/app/works/[id]/not-found.tsx"),
  ]);

  for (const source of [worksError, purchaseError]) {
    assert.match(source, /role="alert"/);
    assert.match(source, /onClick=\{reset\}/);
    assert.match(source, /もう一度読み込む/);
  }
  assert.match(notFound, /作品が見つかりません/);
  assert.match(notFound, /href="\/works"/);
  assert.match(notFound, /href="\/dashboard\/purchases"/);
});

test("skip link・focus・reduced motion契約をMarketplace全体で提供する", async () => {
  const [layout, styles, header, card] = await Promise.all([
    read("src/app/layout.tsx"),
    read("src/app/globals.css"),
    read("src/components/marketplace/MarketplaceHeader.tsx"),
    read("src/components/marketplace/MarketplaceWorkCard.tsx"),
  ]);

  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /本文へ移動/);
  assert.match(layout, /id="main-content"/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /focus-visible:ring-2/);
  assert.match(header, /marketplace-header/);
  assert.match(card, /motion-reduce:transform-none/);
});

test("Phase UI-5でも未契約機能とProduction操作を追加しない", async () => {
  const sources = await Promise.all([
    read("src/app/page.tsx"),
    read("src/app/works/page.tsx"),
    read("src/app/works/[id]/page.tsx"),
    read("src/app/dashboard/purchases/page.tsx"),
  ]);
  const combined = sources.join("\n");

  assert.doesNotMatch(
    combined,
    /フォロー|レビュー|星評価|ランキング|急上昇|レコメンド|Continue Reading/,
  );
  assert.doesNotMatch(combined, /createAdminClient|\.update\(|\.insert\(|\.delete\(/);
});
