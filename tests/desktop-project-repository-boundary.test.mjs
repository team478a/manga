import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const routePath =
  "src/app/api/desktop/projects/[sourceProjectId]/status/route.ts";
const repositoryPath =
  "src/modules/desktop-project/infrastructure/desktop-project-repository.ts";

test("Desktop project status presentation delegates service-role access", async () => {
  const route = await read(routePath);

  assert.match(route, /desktop-project-repository/);
  assert.doesNotMatch(route, /createAdminClient|@\/lib\/supabase\/admin/);
  assert.match(route, /createClient\(\)/);
});

test("PATCH authenticates before repository access and preserves responses", async () => {
  const route = await read(routePath);
  const patch = route.slice(
    route.indexOf("export async function PATCH"),
    route.indexOf("export async function GET"),
  );

  assert.ok(
    patch.indexOf("authorizeDesktopRequest(") <
      patch.indexOf("createDesktopProjectRepository()"),
  );
  assert.ok(
    patch.indexOf("if (!authorization)") <
      patch.indexOf("createDesktopProjectRepository()"),
  );
  for (const contract of [
    '"更新内容が不正です。"',
    '"下書き更新の端末権限がありません。"',
    '"対応するHub作品がありません。"',
    '"Desktopから更新できるのは非公開下書きだけです。"',
    '"Hub側で作品が更新されています。再確認してからやり直してください。"',
    "updated: true",
    '"desktop_hub_draft_updated"',
  ]) {
    assert.ok(patch.includes(contract), contract);
  }
});

test("repository preserves owned draft lookup and optimistic update", async () => {
  const repository = await read(repositoryPath);

  for (const contract of [
    '.select("id, status, is_public, updated_at")',
    '.eq("creator_id", profileId)',
    '.eq("source_project_id", sourceProjectId)',
    '.eq("content_class", "general")',
    '.order("updated_at", { ascending: false })',
    ".limit(1)",
    "description: input.description || null",
    '.eq("id", input.id)',
    '.eq("creator_id", input.profileId)',
    '.eq("status", "draft")',
    '.eq("is_public", false)',
    '.eq("updated_at", input.expectedUpdatedAt)',
    '.select("id, title, description, updated_at")',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
});

test("authorized GET authenticates before repository and preserves owner scope", async () => {
  const route = await read(routePath);
  const get = route.slice(route.indexOf("export async function GET"));

  assert.ok(
    get.indexOf("authorizeDesktopRequest(request)") <
      get.indexOf("createDesktopProjectRepository()"),
  );
  assert.ok(
    get.indexOf("if (!authorization)") <
      get.indexOf("createDesktopProjectRepository()"),
  );
  assert.match(
    get,
    /findOwnedGeneralWorkStatus\(\s*authorization\.profileId,\s*parsed\.data\.sourceProjectId/,
  );
  assert.match(
    get,
    /listOwnedProductStatuses\(\s*authorization\.profileId,\s*work\.id/,
  );
});

test("repository preserves authorized status and sales queries", async () => {
  const repository = await read(repositoryPath);

  for (const contract of [
    '.select("id, title, description, status, is_public, updated_at")',
    '.select("status")',
    '.eq("creator_id", profileId)',
    '.eq("work_id", workId)',
  ]) {
    assert.ok(repository.includes(contract), contract);
  }
});

test("public GET keeps RLS lookup and external response contracts", async () => {
  const route = await read(routePath);
  const get = route.slice(route.indexOf("export async function GET"));
  const publicLookup = get.slice(get.indexOf("const supabase = await createClient()"));

  for (const contract of [
    'request.headers.has("authorization")',
    "const supabase = await createClient()",
    '.eq("status", "published")',
    '.eq("is_public", true)',
    'errorCode: "AUTHENTICATION_REQUIRED"',
    'errorCode: "RESOURCE_NOT_FOUND"',
    "authorized: true",
    "canWriteDraft:",
    "activeProductCount",
    "pausedProductCount",
    "available:",
  ]) {
    assert.ok(get.includes(contract), contract);
  }
  assert.doesNotMatch(publicLookup, /createDesktopProjectRepository/);
});
