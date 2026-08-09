import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const presentationFiles = [
  "src/app/api/desktop/device/authorize/route.ts",
  "src/app/api/desktop/device/token/route.ts",
  "src/app/dashboard/devices/actions.ts",
  "src/app/dashboard/devices/authorize/page.tsx",
  "src/app/dashboard/devices/page.tsx",
];

test("desktop device presentation delegates admin access to its repository", async () => {
  for (const path of presentationFiles) {
    const source = await read(path);
    assert.match(source, /desktop-device-repository/, path);
    assert.doesNotMatch(source, /createAdminClient|@\/lib\/supabase\/admin/, path);
  }
});

test("device authorization start preserves validation, cleanup, retry, and response contracts", async () => {
  const route = await read("src/app/api/desktop/device/authorize/route.ts");

  assert.ok(
    route.indexOf("enforceDesktopDeviceRateLimit(request)") <
      route.indexOf("createDesktopDeviceRepository()"),
  );
  assert.ok(
    route.indexOf("cleanupDesktopDeviceAuthorizations()") <
      route.indexOf("createDesktopDeviceRepository()"),
  );
  assert.match(route, /for \(let attempt = 0; attempt < 5; attempt \+= 1\)/);
  assert.match(route, /error\.code !== "23505"/);
  for (const contract of [
    'status: "pending"',
    "deviceToken",
    "userCode",
    "verificationPath:",
    "expiresAt",
    "intervalSeconds: 5",
    "{ status: 201 }",
  ]) {
    assert.ok(route.includes(contract), contract);
  }
});

test("desktop device repository preserves start, poll, expiry, and token revoke queries", async () => {
  const repository = await read(
    "src/modules/desktop-device/infrastructure/desktop-device-repository.ts",
  );

  for (const contract of [
    'device_name: input.deviceName',
    'secret_hash: input.secretHash',
    'user_code: input.userCode',
    'status: "pending"',
    'expires_at: input.expiresAt',
    'scopes: input.scopes',
    '.select("id, status, expires_at, token_expires_at, approved_at, scopes")',
    '.eq("secret_hash", secretHash)',
    '.update({ status: "expired" })',
    '.update({ status: "revoked", revoked_at: revokedAt })',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
});

test("device token routes authenticate the bearer token before repository access", async () => {
  const route = await read("src/app/api/desktop/device/token/route.ts");
  const getStart = route.indexOf("export async function GET");
  const deleteStart = route.indexOf("export async function DELETE");

  for (const source of [
    route.slice(getStart, deleteStart),
    route.slice(deleteStart),
  ]) {
    assert.ok(source.indexOf("bearerToken(request)") >= 0);
    assert.ok(
      source.indexOf("bearerToken(request)") <
        source.indexOf("createDesktopDeviceRepository()"),
    );
    assert.ok(
      source.indexOf("if (!token)") <
        source.indexOf("createDesktopDeviceRepository()"),
    );
  }
});

test("device dashboard authenticates before owner-scoped repository access", async () => {
  const actions = await read("src/app/dashboard/devices/actions.ts");
  const authorizePage = await read(
    "src/app/dashboard/devices/authorize/page.tsx",
  );
  const listPage = await read("src/app/dashboard/devices/page.tsx");

  assert.ok(
    actions.indexOf("await requireProfile()") <
      actions.indexOf("createDesktopDeviceRepository()"),
  );
  assert.ok(
    authorizePage.indexOf("await requireProfile()") <
      authorizePage.indexOf("createDesktopDeviceRepository()"),
  );
  assert.ok(
    listPage.indexOf("await requireProfile()") <
      listPage.indexOf("createDesktopDeviceRepository()"),
  );
  assert.match(actions, /profileId: profile\.id/);
  assert.match(listPage, /listApprovedForProfile\(\s*profile\.id,/);
});

test("desktop device repository preserves approval, owner revoke, scopes, and list queries", async () => {
  const repository = await read(
    "src/modules/desktop-device/infrastructure/desktop-device-repository.ts",
  );

  for (const contract of [
    '.select("id, expires_at, scopes")',
    'profile_id: input.profileId',
    'status: "approved"',
    '.gt("expires_at", input.approvedAt)',
    '.eq("profile_id", input.profileId)',
    '.select("scopes")',
    '.select("id, device_name, approved_at, last_used_at, token_expires_at")',
    '.order("approved_at", { ascending: false })',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
});
