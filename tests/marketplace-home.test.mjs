import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  hasMarketplacePreview,
  selectMarketplaceHomeSections,
} from "../src/lib/marketplace-home.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function work(overrides = {}) {
  return {
    id: "work-1",
    creator_id: "creator-1",
    title: "作品",
    description: null,
    image_url: null,
    sample_image_urls: [],
    source_project_id: null,
    current_publication_id: null,
    published_version: null,
    published_at: null,
    content_class: "general",
    tags: [],
    status: "published",
    is_public: true,
    created_at: "2026-01-01T00:00:00.000Z",
    digital_products: [],
    ...overrides,
  };
}

test("Marketplace Homeは書店型の主要セクションと購入者導線を提供する", async () => {
  const page = await read("src/app/page.tsx");

  for (const label of [
    "注目作品",
    "新着作品",
    "ジャンルから探す",
    "まずは試し読み",
    "制作環境へ",
  ]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /次に夢中になる漫画を、ここで。/);
  assert.match(page, /href="\/dashboard\/purchases"/);
  assert.match(page, /<MarketplaceWorkShelf/);
});

test("注目作品はactive販売作品だけを新着順で選び人気を推測しない", () => {
  const sections = selectMarketplaceHomeSections([
    work({ id: "old-sale", created_at: "2026-01-01", digital_products: [{ price: 300, status: "active" }] }),
    work({ id: "new-no-sale", created_at: "2026-03-01" }),
    work({ id: "new-sale", created_at: "2026-02-01", digital_products: [{ price: 500, status: "active" }] }),
    work({ id: "paused", created_at: "2026-04-01", digital_products: [{ price: 200, status: "paused" }] }),
  ]);

  assert.deepEqual(sections.highlighted.map(({ id }) => id), ["new-sale", "old-sale"]);
  assert.equal(sections.featured?.id, "new-sale");
  assert.deepEqual(sections.newest.map(({ id }) => id), ["paused", "new-no-sale", "new-sale", "old-sale"]);
});

test("試し読みは既存sampleまたは固定公開版の読書導線がある作品に限定する", () => {
  assert.equal(hasMarketplacePreview(work()), false);
  assert.equal(hasMarketplacePreview(work({ sample_image_urls: ["sample.png"] })), true);
  assert.equal(hasMarketplacePreview(work({ current_publication_id: "publication-1" })), true);
});

test("ジャンル導線は既存tagsを重複除去してworksのtag queryへ渡す", async () => {
  const [page, shelf] = await Promise.all([
    read("src/app/page.tsx"),
    read("src/components/marketplace/MarketplaceWorkShelf.tsx"),
  ]);
  const sections = selectMarketplaceHomeSections([
    work({ tags: ["青春", "ドラマ"] }),
    work({ id: "work-2", tags: ["ドラマ", "SF"] }),
  ]);

  assert.deepEqual(sections.tags, ["SF", "ドラマ", "青春"]);
  assert.match(page, /href=\{`\/works\?tag=\$\{encodeURIComponent\(tag\)\}`\}/);
  assert.match(shelf, /grid-cols-2/);
  assert.match(shelf, /xl:grid-cols-5/);
});

test("Marketplace Homeは公開一般作品とactive商品情報だけを読む", async () => {
  const page = await read("src/app/page.tsx");

  assert.match(page, /\.eq\("is_public", true\)/);
  assert.match(page, /\.eq\("content_class", "general"\)/);
  assert.match(page, /\.eq\("digital_products\.status", "active"\)/);
  assert.doesNotMatch(page, /createAdminClient/);
  assert.doesNotMatch(
    page,
    /\bfavorites?\b|\breviews?\b|\bratings?\b|\brankings?\b|\brecommendations?\b/i,
  );
});
