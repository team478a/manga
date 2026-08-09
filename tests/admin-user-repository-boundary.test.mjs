import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const presentationPaths = [
  "src/app/admin/users/page.tsx",
  "src/app/admin/users/[id]/page.tsx",
  "src/app/admin/users/account-actions.ts",
];

test("admin user presentation authenticates before repository access", async () => {
  for (const path of presentationPaths) {
    const source = await read(path);
    assert.match(source, /requireAdmin/, path);
    assert.match(source, /admin-user-repository/, path);
    assert.doesNotMatch(
      source,
      /createAdminClient|@\/lib\/supabase\/admin/,
      path,
    );
  }

  const [listPage, detailPage, actions] = await Promise.all(
    presentationPaths.map(read),
  );
  const listAuthIndex = listPage.indexOf("await requireAdmin()");
  const detailAuthIndex = detailPage.indexOf("await requireAdmin()");
  const actionAuthIndex = actions.indexOf("await requireAdmin()");
  assert.ok(
    listAuthIndex < listPage.indexOf("loadAdminUserProfiles", listAuthIndex),
  );
  assert.ok(
    detailAuthIndex <
      detailPage.indexOf("loadAdminUserProfile(id)", detailAuthIndex),
  );
  assert.ok(
    actionAuthIndex <
      actions.indexOf("loadAdminUserActionTarget", actionAuthIndex),
  );
});

test("admin user repository preserves query and Auth Admin contracts", async () => {
  const repository = await read(
    "src/modules/account/infrastructure/admin-user-repository.ts",
  );
  for (const contract of [
    'select("id,user_id,display_name,role,created_at")',
    'order("created_at", { ascending: false })',
    "listUsers({ page: 1, perPage: 1000 })",
    'select("profile_id,invite_email_sent_at,invite_email_send_count")',
    'select("status,source,valid_until,admin_note")',
    '.eq("feature_key", "adult_planning")',
    'select("id,user_id,role")',
    'ban_duration: "876000h"',
    'ban_duration: "none"',
    "deleteUser(userId, true)",
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
  assert.match(repository, /if \(input\.includeGeneralMonitor\)/);
  assert.match(repository, /getUserById\(input\.userId\)/);
  assert.match(repository, /\.eq\("id", profileId\)/);
  assert.match(repository, /\.eq\("profile_id", input\.profileId\)/);
});

test("admin user repository does not introduce provider access", async () => {
  const repository = await read(
    "src/modules/account/infrastructure/admin-user-repository.ts",
  );
  assert.doesNotMatch(
    repository,
    /openai|anthropic|black-forest|provider.*generate/iu,
  );
});
