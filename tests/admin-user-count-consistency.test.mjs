import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  countVisibleAdminUserProfiles,
  filterVisibleAdminUserProfiles,
} from "../src/modules/account/application/admin-user-visibility.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("管理画面のユーザー件数は削除済みAuthアカウントを除外する", () => {
  const profiles = [
    { user_id: "active-user", display_name: "利用中" },
    { user_id: "suspended-user", display_name: "停止中" },
    { user_id: "deleted-user", display_name: "削除済み" },
    { user_id: "orphan-profile", display_name: "Authなし" },
  ];
  const authUsers = [
    { id: "active-user", deleted_at: null },
    { id: "suspended-user", deleted_at: null },
    { id: "deleted-user", deleted_at: "2026-08-11T00:00:00.000Z" },
  ];

  assert.deepEqual(
    filterVisibleAdminUserProfiles(profiles, authUsers).map(
      (profile) => profile.user_id,
    ),
    ["active-user", "suspended-user"],
  );
  assert.equal(countVisibleAdminUserProfiles(profiles, authUsers), 2);
});

test("Auth Admin未設定時は従来どおりProfile件数を表示する", () => {
  const profiles = [{ user_id: "first" }, { user_id: "second" }];
  assert.equal(countVisibleAdminUserProfiles(profiles, null), 2);
});

test("管理画面TOPとユーザー一覧は同じ可視ユーザー判定を使う", async () => {
  const [dashboard, usersPage, repository] = await Promise.all([
    read("src/app/admin/page.tsx"),
    read("src/app/admin/users/page.tsx"),
    read("src/modules/account/infrastructure/admin-user-repository.ts"),
  ]);

  assert.match(dashboard, /loadAdminVisibleUserCount/);
  assert.doesNotMatch(
    dashboard,
    /from\("profiles"\)\.select\("id", \{ count: "exact", head: true \}\)/,
  );
  assert.match(usersPage, /filterVisibleAdminUserProfiles/);
  assert.match(repository, /countVisibleAdminUserProfiles/);
  assert.match(repository, /loadAdminAuthUsers/);
  assert.match(repository, /authResult\.data\?\.users \?\? \[\]/);
});
