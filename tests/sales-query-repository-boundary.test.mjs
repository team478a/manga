import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("売上画面は認証後に出品者本人の注文だけをrepositoryから取得する", async () => {
  const [page, repository] = await Promise.all([
    read("src/app/dashboard/sales/page.tsx"),
    read("src/modules/sales/infrastructure/sales-query-repository.ts"),
  ]);

  assert.ok(page.indexOf("requireProfile()") < page.indexOf("listSalesOrdersForCreator(profile.id)"));
  assert.match(repository, /createClient\(\)/);
  assert.match(repository, /\.from\("orders"\)/);
  assert.match(repository, /\.eq\("creator_id", profileId\)/);
  assert.match(repository, /\.order\("created_at", \{ ascending: false \}\)/);
  assert.doesNotMatch(repository, /createAdminClient|buyer_profile_id/);
});

test("売上読込失敗を売上0円や注文0件として表示しない", async () => {
  const page = await read("src/app/dashboard/sales/page.tsx");

  assert.match(page, /const \{ data, error \} = await listSalesOrdersForCreator/);
  assert.match(page, /const total = error[\s\S]*\? null/);
  assert.match(page, /total === null \? "確認できません" : yen\(total\)/);
  assert.match(page, /売上や注文が0件になったわけではありません/);
  assert.match(page, /注文一覧を空として扱わず、読込を停止しました/);
  assert.match(page, /error \? \([\s\S]*注文・売上情報を再読み込み[\s\S]*\) : orders\.length/);
});
