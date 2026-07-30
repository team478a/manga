import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudStoryboardCanvasFeatureEnabled,
  getCloudStoryboardMaterializationWithPersistence,
  materializeCloudStoryboardWithPersistence,
} from "../src/lib/cloud-storyboard-materialization.ts";

const profileId = "10000000-0000-4000-8000-000000000001";
const storyboardVersionId = "70000000-0000-4000-8000-000000000001";
const projectId = "90000000-0000-4000-8000-000000000001";
const firstPageId = "a0000000-0000-4000-8000-000000000001";

const persistence = (overrides = {}) => ({
  find: async () => ({ data: null, error: null }),
  materialize: async () => ({
    data: [{ project_id: projectId, first_page_id: firstPageId, was_created: true }],
    error: null,
  }),
  ...overrides,
});

test("Release 5 Feature Flagは未設定時fail closedする", () => {
  const previous = process.env.CLOUD_STORYBOARD_CANVAS_ENABLED;
  delete process.env.CLOUD_STORYBOARD_CANVAS_ENABLED;
  assert.equal(cloudStoryboardCanvasFeatureEnabled(), false);
  if (previous !== undefined)
    process.env.CLOUD_STORYBOARD_CANVAS_ENABLED = previous;
});

test("不正UUIDはDB参照前に拒否する", async () => {
  let queried = false;
  await assert.rejects(
    getCloudStoryboardMaterializationWithPersistence({
      profileId,
      storyboardVersionId: "invalid",
      persistence: persistence({
        find: async () => {
          queried = true;
          return { data: null, error: null };
        },
      }),
    }),
    /見つかりません/,
  );
  assert.equal(queried, false);
});

test("採用済みネームから作成されたProject情報を返す", async () => {
  const result = await materializeCloudStoryboardWithPersistence({
    storyboardVersionId,
    persistence: persistence(),
  });
  assert.deepEqual(result, {
    project_id: projectId,
    first_page_id: firstPageId,
    was_created: true,
  });
});

test("DB内部エラーを利用者へ露出しない", async () => {
  await assert.rejects(
    materializeCloudStoryboardWithPersistence({
      storyboardVersionId,
      persistence: persistence({
        materialize: async () => ({
          data: null,
          error: { message: "postgres secret detail", code: "P0001" },
        }),
      }),
    }),
    (error) => {
      assert.match(error.message, /Canvas下書きを作成できませんでした/);
      assert.doesNotMatch(error.message, /postgres secret detail|P0001/);
      return true;
    },
  );
});
