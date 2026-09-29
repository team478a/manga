import assert from "node:assert/strict";
import { test } from "node:test";
import { assessMarketplacePublicationFixationReadiness } from "../src/modules/checkout/domain/publication-fixation-readiness.ts";

const ids = {
  checkpoint: "11111111-1111-4111-8111-111111111111",
  creator: "22222222-2222-4222-8222-222222222222",
  product: "33333333-3333-4333-8333-333333333333",
  project: "44444444-4444-4444-8444-444444444444",
  work: "55555555-5555-4555-8555-555555555555",
};

const fixture = () => ({
  works: [{
    id: ids.work,
    creator_id: ids.creator,
    source_project_id: ids.project,
    current_publication_id: null,
    content_class: "general",
    status: "draft",
    is_public: false,
  }],
  products: [{ work_id: ids.work, creator_id: ids.creator, status: "paused" }],
  projects: [{
    id: ids.project,
    owner_profile_id: ids.creator,
    content_class: "general",
    deleted_at: null,
  }],
  checkpoints: [{
    id: ids.checkpoint,
    project_id: ids.project,
    created_by_profile_id: ids.creator,
    kind: "release",
    page_count: 2,
    manifest_sha256: "a".repeat(64),
  }],
  checkpointPages: [
    { checkpoint_id: ids.checkpoint, page_number: 1 },
    { checkpoint_id: ids.checkpoint, page_number: 2 },
  ],
});

test("所有者・paused商品・完成版ページが揃うCloud作品だけ固定候補にする", () => {
  const report = assessMarketplacePublicationFixationReadiness(fixture());

  assert.equal(report.passed, true);
  assert.deepEqual(report.counts, {
    checkedCloudWorks: 1,
    unpinnedMutableCloudWorks: 1,
    ownerAlignedCloudWorks: 1,
    pausedProductCloudWorks: 1,
    releaseCheckpoints: 1,
    completeReleaseCheckpoints: 1,
    fixationReadyWorks: 1,
    fixationReadyProducts: 1,
  });
  assert.equal(report.safety.productionMutation, false);
  assert.equal(report.safety.storageObjectRead, false);
  assert.equal(report.safety.syncRpcCalled, false);
});

test("release checkpointのページ欠落は固定候補にしない", () => {
  const input = fixture();
  input.checkpointPages.pop();
  const report = assessMarketplacePublicationFixationReadiness(input);

  assert.equal(report.passed, false);
  assert.equal(report.counts.completeReleaseCheckpoints, 0);
  assert.equal(report.counts.fixationReadyWorks, 0);
  assert.equal(
    report.checks.find((item) => item.id === "complete-checkpoint-pages")?.ready,
    false,
  );
});

test("公開済み・固定済み・所有者不一致の作品は再同期候補にしない", () => {
  for (const mutate of [
    (input) => { input.works[0].status = "published"; input.works[0].is_public = true; },
    (input) => { input.works[0].current_publication_id = ids.checkpoint; },
    (input) => { input.projects[0].owner_profile_id = ids.product; },
  ]) {
    const input = fixture();
    mutate(input);
    const report = assessMarketplacePublicationFixationReadiness(input);
    assert.equal(report.passed, false);
    assert.equal(report.counts.fixationReadyWorks, 0);
  }
});

test("paused商品が重複する作品は候補を確定しない", () => {
  const input = fixture();
  input.products.push({ ...input.products[0], status: "active" });
  const report = assessMarketplacePublicationFixationReadiness(input);

  assert.equal(report.passed, false);
  assert.equal(report.counts.fixationReadyWorks, 0);
  assert.equal(report.counts.fixationReadyProducts, 0);
});
