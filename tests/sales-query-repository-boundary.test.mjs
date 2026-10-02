import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("売上画面は認証後に出品者本人の注文だけをrepositoryから取得する", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
  ]);

  assert.ok(
    page.indexOf("requireProfile()") <
      page.indexOf("listSalesOrdersForCreator(profile.id)"),
  );
  assert.match(repository, /createClient\(\)/);
  assert.match(repository, /\.from\("orders"\)/);
  assert.match(repository, /\.eq\("creator_id", profileId\)/);
  assert.match(repository, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(repository, /createAdminClient|buyer_profile_id/);
});

test("売上読込失敗を売上0円や注文0件として表示しない", async () => {
  const page = await read("src/app/dashboard/sales/page.tsx");

  assert.match(
    page,
    /const \{ data, error \} = await listSalesOrdersForCreator/,
  );
  assert.match(page, /const total = error[\s\S]*\? null/);
  assert.match(page, /total === null \? "確認できません" : yen\(total\)/);
  assert.match(page, /売上や注文が0件になったわけではありません/);
  assert.match(page, /注文一覧を空として扱わず、読込を停止しました/);
  assert.match(
    page,
    /error \? \([\s\S]*注文・売上情報を再読み込み[\s\S]*\) : orders\.length/,
  );
});

test("注文がない販売者は再読み込みと販売中作品・手順へ戻れる", async () => {
  const page = await read("src/app/dashboard/sales/page.tsx");

  assert.match(page, /指定購入者が購入手続きを完了すると/);
  assert.match(page, /画面を開いたままでは自動更新されない/);
  assert.match(page, /href="\/dashboard\/sales"/);
  assert.match(page, /注文・売上情報を再読み込み/);
  assert.match(page, /href="\/creator"/);
  assert.match(page, /販売中の作品を確認/);
  assert.match(page, /href="\/dashboard\/monitor\/guide#internal-test-sale"/);
  assert.match(page, /テスト販売の手順/);
});

test("注文一覧は日本時間の受付日時と状態の意味を表示する", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
  ]);

  assert.match(repository, /created_at/);
  assert.match(repository, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.match(page, /timeZone: "Asia\/Tokyo"/);
  assert.match(page, /<th className="py-3">受付日時<\/th>/);
  assert.match(page, /<time dateTime=\{order\.created_at\}>/);
  assert.match(page, /受付済み.+決済確認前/);
  assert.match(page, /支払い済み.+購入完了/);
  assert.match(
    page,
    /失敗・キャンセル・返金済みの注文は受取予定額に含みません/,
  );
});

test("注文から所有する作品・商品設定へ戻れる", async () => {
  const [page, repository, workEdit, productEdit] = await Promise.all([
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
    read("src/app/dashboard/works/[id]/edit/page.tsx"),
    read("src/app/dashboard/products/[id]/edit/page.tsx"),
  ]);

  assert.match(
    repository,
    /digital_products:product_id\(id,title,works:work_id\(id,title\)\)/,
  );
  assert.match(page, /作品名・商品名から、所有する設定画面へ戻れます/);
  assert.match(
    page,
    /href=\{`\/dashboard\/works\/\$\{order\.digital_products\.works\.id\}\/edit`\}/,
  );
  assert.match(
    page,
    /href=\{`\/dashboard\/products\/\$\{order\.digital_products\.id\}\/edit`\}/,
  );
  assert.match(workEdit, /\.eq\("creator_id", profile\.id\)/);
  assert.match(productEdit, /\.eq\("creator_id", profile\.id\)/);
  assert.doesNotMatch(repository, /createAdminClient/);
});

test("スマートフォンでは注文を横スクロールなしのカードで確認できる", async () => {
  const page = await read("src/app/dashboard/sales/page.tsx");

  assert.match(page, /aria-label="スマートフォン向け注文一覧"/);
  assert.match(page, /className="mt-5 space-y-4 md:hidden"/);
  assert.match(page, /className="mt-5 hidden overflow-x-auto md:block"/);
  assert.match(page, /<dt className="text-stone-500">購入者<\/dt>/);
  assert.match(page, /<dt className="text-stone-500">状態<\/dt>/);
  assert.match(page, /<dt className="text-stone-500">販売金額<\/dt>/);
  assert.match(page, /<dt className="text-stone-500">手数料<\/dt>/);
  assert.match(page, /<dt className="text-stone-500">受取<\/dt>/);
  assert.match(page, /break-all text-stone-900/);
  assert.match(page, /order\.payment_mode === "test" \? "テスト" : "本番"/);
  assert.match(page, /<OrderSourceLinks order=\{order\} \/>/);
});
