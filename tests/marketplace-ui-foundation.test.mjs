import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Marketplace headerは書店検索と既存の購入者・制作者導線を提供する", async () => {
  const [header, adapter] = await Promise.all([
    read("src/components/marketplace/MarketplaceHeader.tsx"),
    read("src/components/Header.tsx"),
  ]);

  assert.match(header, /インディーズ漫画のデジタル書店/);
  assert.match(header, /action="\/works"/);
  assert.match(header, /href="\/dashboard\/purchases"/);
  assert.match(header, /href="\/creator"/);
  assert.match(header, /profile\?\.role === "creator"/);
  assert.match(header, /profile\?\.role === "admin"/);
  assert.match(adapter, /getCurrentProfile/);
  assert.match(adapter, /<MarketplaceHeader profile=\{profile\}/);
});

test("モバイル下部ナビは購入者向け4項目に限定しReaderを覆わない", async () => {
  const navigation = await read(
    "src/components/marketplace/MarketplaceMobileNavigation.tsx",
  );

  for (const label of ["ホーム", "探す", "本棚", "マイページ"]) {
    assert.match(navigation, new RegExp(`label: "${label}"`));
  }
  assert.match(navigation, /pathname === "\/dashboard\/purchases"/);
  assert.ok(navigation.includes('/^\\/works\\/[^/]+$/.test(pathname)'));
});

test("作品一覧はスマホ2列・PC4〜5列で表紙全体を表示する", async () => {
  const [page, card, cover] = await Promise.all([
    read("src/app/works/page.tsx"),
    read("src/components/marketplace/MarketplaceWorkCard.tsx"),
    read("src/components/marketplace/MarketplaceCover.tsx"),
  ]);

  assert.match(page, /grid-cols-2/);
  assert.match(page, /lg:grid-cols-4/);
  assert.match(page, /xl:grid-cols-5/);
  assert.match(page, /<MarketplaceWorkCard/);
  assert.match(card, /<MarketplaceCover/);
  assert.match(card, /focus-visible:ring-2/);
  assert.match(cover, /aspect-\[2\/3\]/);
  assert.match(cover, /alt=\{`\$\{title\}の表紙`\}/);
  assert.match(cover, /object-contain/);
  assert.doesNotMatch(cover, /object-cover/);
});

test("検索フィルターは既存のq・tag・sale契約を維持する", async () => {
  const filters = await read(
    "src/components/marketplace/MarketplaceSearchFilters.tsx",
  );

  assert.match(filters, /query\.set\("q", keyword\)/);
  assert.match(filters, /query\.set\("tag", selectedTag\)/);
  assert.match(filters, /query\.set\("sale", "active"\)/);
  assert.match(filters, /ジャンル・タグ/);
  assert.match(filters, /販売中のみ/);
  const styles = await read("src/app/globals.css");
  assert.match(styles, /\.marketplace-filter-chip[\s\S]*min-h-11/);
});
