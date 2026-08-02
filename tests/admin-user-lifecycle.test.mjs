import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("管理者は一般ユーザーを停止・再開・安全に削除できる", async () => {
  const actions = await readFile(
    new URL("../src/app/admin/users/account-actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /target\.user_id === actorUser\.id/);
  assert.match(actions, /target\.role === "admin"/);
  assert.match(actions, /ban_duration: "876000h"/);
  assert.match(actions, /ban_duration: "none"/);
  assert.match(actions, /deleteUser\(target\.user_id, true\)/);
  assert.doesNotMatch(actions, /error\.message/);
});

test("ユーザー一覧は確認付き操作と処理中表示を提供する", async () => {
  const [page, controls] = await Promise.all([
    readFile(new URL("../src/app/admin/users/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/admin/users/AdminUserAccountActions.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(page, /停止中/);
  assert.match(page, /削除済み/);
  assert.match(page, /user\.role !== "admin"/);
  assert.match(controls, /window\.confirm/);
  assert.match(controls, /pendingLabel="停止中…"/);
  assert.match(controls, /pendingLabel="再開中…"/);
  assert.match(controls, /pendingLabel="削除中…"/);
});
