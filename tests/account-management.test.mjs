import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("利用者は登録情報とアカウント管理機能を確認できる", async () => {
  const [page, actions, header, dashboard] = await Promise.all([
    readFile(new URL("../src/app/dashboard/account/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/account/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/Header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8"),
  ]);

  for (const label of ["現在の登録情報", "メールアドレス", "アカウント種別", "登録日時", "最終ログイン"]) {
    assert.match(page, new RegExp(label));
  }
  assert.match(page, /updateProfile/);
  assert.match(page, /updateAccountEmailAction/);
  assert.match(page, /updateAccountPasswordAction/);
  assert.match(page, /PendingSubmitButton/);
  assert.match(actions, /auth\.updateUser/);
  assert.match(actions, /auth\.signOut/);
  assert.match(actions, /encodeURIComponent/);
  assert.match(header, /href="\/dashboard\/account"/);
  assert.match(dashboard, /登録情報を確認・変更/);
});

test("アカウント操作は未知の認証エラーを利用者へ露出しない", async () => {
  const actions = await readFile(
    new URL("../src/app/dashboard/account/actions.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(actions, /error\.message/);
  assert.doesNotMatch(actions, /throw new Error/);
});
