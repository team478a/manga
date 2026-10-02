import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("本棚は表紙全体・タイトル・作者を中心とした購入作品カードを表示する", async () => {
  const [page, repository, cover] = await Promise.all([
    read("src/app/dashboard/purchases/page.tsx"),
    read("src/modules/purchases/infrastructure/purchase-query-repository.ts"),
    read("src/components/marketplace/MarketplaceCover.tsx"),
  ]);

  assert.match(page, /MY BOOKSHELF/);
  assert.match(page, />\s*本棚\s*</);
  assert.match(page, /<MarketplaceCover/);
  assert.match(cover, /object-contain/);
  assert.match(page, /work\?\.title/);
  assert.match(page, /product\?\.profiles\?\.display_name/);
  assert.match(repository, /profiles:creator_id\(display_name\)/);
  assert.match(
    repository,
    /works:work_id\(id,title,image_url,current_publication_id\)/,
  );
});

test("支払済み購入は既存ReaderとDownload routeだけを利用する", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.match(page, /purchase\.status === "paid"/);
  assert.match(page, /const readerHref = savedPage/);
  assert.match(page, /href=\{readerHref\}/);
  assert.match(page, /漫画を読む/);
  assert.match(page, /href=\{`\/api\/purchases\/\$\{purchase\.id\}\/download`\}/);
  assert.match(page, /Download/);
  assert.match(page, /5分間有効なURLを再発行/);
});

test("本棚は読込失敗・空・返金済みを別状態として表示する", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.match(page, /購入履歴を空として扱わず、読込を停止しました/);
  assert.match(page, /購入履歴を再読み込み/);
  assert.match(page, /本棚はまだ空です。/);
  assert.match(page, /公開作品を確認/);
  assert.match(page, /この購入は返金済みのため利用できません/);
});

test("本棚は続きから読む以外の未契約評価・推薦機能を追加しない", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.doesNotMatch(
    page,
    /フォロー|レビュー|星評価|ランキング|急上昇|レコメンド/,
  );
});
