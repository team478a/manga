import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("作品詳細は縦長表紙・作者・タグ・あらすじを中心に構成する", async () => {
  const page = await read("src/app/works/[id]/page.tsx");

  assert.match(page, /aspect-\[2\/3\]/);
  assert.match(page, /alt=\{`\$\{work\.title\}の表紙`\}/);
  assert.match(page, /クリエイター：\{creatorName\}/);
  assert.match(page, /作品について/);
  assert.match(page, /work\.description \|\| "あらすじはまだありません。"/);
  assert.match(page, /work\.tags\.map/);
});

test("固定公開版と既存サンプルの試し読み導線を強く表示する", async () => {
  const page = await read("src/app/works/[id]/page.tsx");

  assert.match(page, /work\.current_publication_id/);
  assert.match(page, /href=\{`\/works\/\$\{work\.id\}\/read`\}/);
  assert.match(page, /漫画を読む・試し読み/);
  assert.match(page, /href="#preview"/);
  assert.match(page, /サンプルを試し読み/);
  assert.match(page, /id="preview"/);
  assert.match(page, /object-contain/);
});

test("価格と購入CTAは既存active商品・Checkout canary契約を維持する", async () => {
  const page = await read("src/app/works/[id]/page.tsx");

  assert.match(page, /\.eq\("status", "active"\)/);
  assert.match(page, /isMarketplaceCanaryCheckoutListing/);
  assert.match(page, /isMarketplaceCanaryCheckoutTarget/);
  assert.match(page, /buyerProfileId/);
  assert.match(page, /href=\{`\/checkout\/\$\{product\.id\}`\}/);
  assert.match(page, /購入する/);
  assert.match(page, /購入準備へ/);
  assert.match(page, /購入準備中/);
});

test("Creator sectionは作者表示に限定し未契約のFollowやReviewを追加しない", async () => {
  const page = await read("src/app/works/[id]/page.tsx");

  assert.match(page, /この作品のクリエイター/);
  assert.match(page, /\{creatorName\}/);
  assert.doesNotMatch(page, /お気に入り|フォロー|レビュー|星評価|ランキング|急上昇/);
});
