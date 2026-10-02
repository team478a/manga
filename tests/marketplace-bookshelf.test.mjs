import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("本棚は表紙・タイトル・作者を中心とした購入作品カードを表示する", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/dashboard/purchases/page.tsx"),
    read("src/modules/purchases/infrastructure/purchase-query-repository.ts"),
  ]);

  assert.match(page, /MY BOOKSHELF/);
  assert.match(page, />\s*本棚\s*</);
  assert.match(page, /aspect-\[2\/3\]/);
  assert.match(page, /work\?\.title/);
  assert.match(page, /product\?\.profiles\?\.display_name/);
  assert.match(repository, /profiles:creator_id\(display_name\)/);
  assert.match(repository, /works:work_id\(id,title,image_url\)/);
});

test("支払済み購入は既存ReaderとDownload routeだけを利用する", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.match(page, /purchase\.status === "paid"/);
  assert.match(page, /href=\{`\/works\/\$\{work!\.id\}\/read`\}/);
  assert.match(page, /漫画を読む/);
  assert.match(page, /href=\{`\/api\/purchases\/\$\{purchase\.id\}\/download`\}/);
  assert.match(page, /Download/);
  assert.match(page, /5分間有効なURLを再発行/);
});

test("本棚は読込失敗・空・返金済みを別状態として表示する", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.match(page, /購入履歴を空として扱わず、読込を停止しました/);
  assert.match(page, /購入履歴を再読み込み/);
  assert.match(page, /購入履歴はありません。/);
  assert.match(page, /公開作品を確認/);
  assert.match(page, /この購入は返金済みのため利用できません/);
});

test("本棚に未契約の継続読書・評価機能を追加しない", async () => {
  const page = await read("src/app/dashboard/purchases/page.tsx");

  assert.doesNotMatch(
    page,
    /Continue Reading|続きを読む|お気に入り|フォロー|レビュー|星評価|ランキング|急上昇|レコメンド/,
  );
});
