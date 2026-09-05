import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("購入者向け画面は先行販売購入者の権利と先行利用形態を明示する", async () => {
  const [dashboard, monitor, welcome, review, guide] = await Promise.all([
    read("../src/app/dashboard/page.tsx"),
    read("../src/app/dashboard/monitor/page.tsx"),
    read("../src/app/dashboard/monitor/welcome/page.tsx"),
    read("../src/app/dashboard/monitor/quality-review/page.tsx"),
    read("../src/app/dashboard/monitor/guide/page.tsx"),
  ]);

  for (const source of [dashboard, monitor, welcome, review, guide]) {
    assert.match(source, /先行販売購入者向け/);
  }
  assert.match(monitor, /一般的なモニター募集ではありません/);
  assert.match(monitor, /正式リリース後の利用資格は失われません/);
  assert.match(welcome, /購入者としての権利/);
  assert.match(guide, /購入者としての権利や正式リリース後の利用資格は失われません/);
});

test("既存の標準招待文面だけを購入者向け表記へ移行する", async () => {
  const migration = await read("../supabase/migrations/202609050002_purchaser_early_access_wording.sql");

  assert.match(migration, /subject_template='MANGAI 一般向けモニターのご案内'/);
  assert.match(migration, /body_template=\$template\$/);
  assert.match(migration, /先行販売でご購入いただいたお客様/);
  assert.match(migration, /購入者としての権利/);
  assert.doesNotMatch(migration, /updated_by_profile_id|updated_at=now\(\)/);
});
