import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const actionContracts = [
  {
    path: "src/app/admin/users/[id]/adult-feature-actions.ts",
    repositoryCall: "setAdultPlanningGrant(",
  },
  {
    path: "src/app/admin/users/[id]/adult-research-actions.ts",
    repositoryCall: "setAdultResearchEntitlement(",
  },
];

test("adult entitlement actions authenticate before repository access", async () => {
  for (const contract of actionContracts) {
    const source = await read(contract.path);
    assert.match(source, /requireAdmin/, contract.path);
    assert.match(source, /safelyLoadAdminData/, contract.path);
    assert.doesNotMatch(
      source,
      /createAdminClient|@\/lib\/supabase\/admin/,
      contract.path,
    );
    assert.ok(
      source.indexOf("await requireAdmin()") <
        source.indexOf(contract.repositoryCall),
      contract.path,
    );
  }
});

test("adult entitlement repositories preserve target lookup and RPC contracts", async () => {
  const [planning, research] = await Promise.all([
    read("src/modules/adult-planning/infrastructure/admin-repository.ts"),
    read("src/modules/adult-research/infrastructure/admin-repository.ts"),
  ]);
  for (const repository of [planning, research]) {
    assert.match(repository, /\.from\("profiles"\)/);
    assert.match(repository, /\.select\("id"\)/);
    assert.match(repository, /\.eq\("id", input\.targetProfileId\)/);
    assert.match(repository, /\.maybeSingle<\{ id: string \}>\(\)/);
    assert.match(repository, /p_actor_profile_id: input\.actorProfileId/);
    assert.match(repository, /p_target_profile_id: input\.targetProfileId/);
    assert.match(repository, /p_valid_until: input\.validUntil/);
    assert.match(repository, /p_admin_note: input\.adminNote/);
  }
  assert.match(planning, /set_cloud_adult_feature_grant/);
  assert.match(planning, /CLOUD_ADULT_PLANNING_FEATURE_KEY/);
  assert.match(research, /set_cloud_adult_research_entitlement/);
});

test("adult entitlement repositories do not introduce provider access", async () => {
  const repositories = await Promise.all([
    read("src/modules/adult-planning/infrastructure/admin-repository.ts"),
    read("src/modules/adult-research/infrastructure/admin-repository.ts"),
  ]);
  assert.doesNotMatch(
    repositories.join("\n"),
    /openai|anthropic|black-forest|provider.*generate/iu,
  );
});
