import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("管理者は一般ユーザーを停止・再開・安全に削除できる", async () => {
  const [actions, repository] = await Promise.all([
    readFile(
      new URL("../src/app/admin/users/account-actions.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/account/infrastructure/admin-user-repository.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(actions, /requireAdmin/);
  assert.match(actions, /target\.user_id === actorUser\.id/);
  assert.match(actions, /target\.role === "admin"/);
  assert.match(actions, /suspendAdminUser\(target\.user_id\)/);
  assert.match(actions, /restoreAdminUser\(target\.user_id\)/);
  assert.match(actions, /softDeleteAdminUser\(target\.user_id\)/);
  assert.match(repository, /ban_duration: "876000h"/);
  assert.match(repository, /ban_duration: "none"/);
  assert.match(repository, /deleteUser\(userId, true\)/);
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
  assert.match(page, /state !== "deleted"/);
  assert.match(page, /招待メール/);
  assert.match(page, /invite_email_sent_at/);
  assert.match(page, /lastSignInAt/);
  assert.match(page, /最終/);
  assert.match(page, /ユーザーを検索/);
  assert.match(page, /name="account"/);
  assert.match(page, /name="invite"/);
  assert.match(page, /name="login"/);
  assert.match(page, /filteredUsers/);
  assert.match(page, /条件に一致するユーザーはいません/);
  assert.match(page, /user\.role !== "admin"/);
  assert.match(controls, /window\.confirm/);
  assert.match(controls, /pendingLabel="停止中…"/);
  assert.match(controls, /pendingLabel="再開中…"/);
  assert.match(controls, /pendingLabel="削除中…"/);
});

test("招待メール成功時だけ送信日時と回数を記録する", async () => {
  const [actions, repository, migration] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/users/[id]/general-monitor-actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/modules/general-monitor/infrastructure/admin-monitor-repository.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202608020001_cloud_general_monitor_invite_tracking.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);
  assert.match(actions, /sendCloudGeneralMonitorInviteEmail/);
  assert.match(actions, /recordGeneralMonitorInviteDelivery/);
  assert.match(repository, /record_cloud_general_monitor_invite_email_sent/);
  assert.match(migration, /invite_email_sent_at/);
  assert.match(migration, /invite_email_send_count/);
  assert.match(migration, /auth\.role\(\)<>'service_role'/);
});
