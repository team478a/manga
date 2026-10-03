import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildCloudMarketplaceDraftGuidance } from "../src/lib/cloud-marketplace-draft-guidance.ts";
import { buildCloudMarketplaceSalesGuidance } from "../src/lib/cloud-marketplace-sales-guidance.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("販売artifact生成入口は完成原稿preflightを必須にする", async () => {
  const source = await read(
    "src/modules/cloud-creator/export/prepare-project-export.ts",
  );
  const functionStart = source.indexOf(
    "export async function createCloudMarketplaceArtifacts",
  );
  const functionSource = source.slice(functionStart);
  const preflightIndex = functionSource.indexOf("getCloudManuscriptPreflight");
  const assertionIndex = functionSource.indexOf(
    "assertCloudMarketplaceManuscriptReady",
  );
  const stagingIndex = functionSource.indexOf("stageExport(projectId)");

  assert.ok(functionStart >= 0);
  assert.ok(preflightIndex >= 0);
  assert.match(functionSource, /requireFinalizedPages:\s*true/);
  assert.ok(assertionIndex > preflightIndex);
  assert.ok(stagingIndex > assertionIndex);
});

test("販売下書きは原稿確認と完成版固定を順番に案内する", () => {
  const unavailable = buildCloudMarketplaceDraftGuidance({
    manuscriptAvailable: false,
    manuscriptErrorCount: 0,
    manuscriptReady: false,
    releaseCheckpointCount: 0,
  });
  const manuscript = buildCloudMarketplaceDraftGuidance({
    manuscriptAvailable: true,
    manuscriptErrorCount: 3,
    manuscriptReady: false,
    releaseCheckpointCount: 0,
  });
  const checkpoint = buildCloudMarketplaceDraftGuidance({
    manuscriptAvailable: true,
    manuscriptErrorCount: 0,
    manuscriptReady: true,
    releaseCheckpointCount: 0,
  });
  const ready = buildCloudMarketplaceDraftGuidance({
    manuscriptAvailable: true,
    manuscriptErrorCount: 0,
    manuscriptReady: true,
    releaseCheckpointCount: 1,
  });

  assert.equal(unavailable.stage, "manuscript_unavailable");
  assert.equal(unavailable.action, null);
  assert.match(manuscript.summary, /要修正3件/);
  assert.equal(manuscript.action?.href, "#manuscript-status");
  assert.equal(checkpoint.stage, "release_checkpoint_missing");
  assert.equal(checkpoint.action?.href, "#checkpoint-heading");
  assert.equal(ready.ready, true);
});

test("Creator画面は案内が未完了なら販売操作を無効化する", async () => {
  const page = await read("src/app/creator/[projectId]/page.tsx");

  assert.match(page, /buildCloudMarketplaceDraftGuidance/);
  assert.match(page, /disabled=\{!marketplaceGuidance\.ready\}/);
  assert.match(page, /marketplaceGuidance\.summary/);
  assert.match(page, /marketplaceGuidance\.action\.href/);
  assert.match(page, /id="marketplace-listing"/);
  assert.match(page, /aria-labelledby="marketplace-listing-heading"/);
});

test("販売下書き後は完成版固定、作品公開、商品販売を順番に案内する", () => {
  const base = {
    currentPublicationId: null,
    productAvailable: true,
    productStatus: "paused",
    workAvailable: true,
    workIsPublic: false,
    workStatus: "draft",
  };

  const publication = buildCloudMarketplaceSalesGuidance(base);
  const work = buildCloudMarketplaceSalesGuidance({
    ...base,
    currentPublicationId: "publication-1",
  });
  const product = buildCloudMarketplaceSalesGuidance({
    ...base,
    currentPublicationId: "publication-1",
    workIsPublic: true,
    workStatus: "published",
  });
  const ready = buildCloudMarketplaceSalesGuidance({
    ...base,
    currentPublicationId: "publication-1",
    productStatus: "active",
    workIsPublic: true,
    workStatus: "published",
  });

  assert.equal(publication.stage, "publication_missing");
  assert.equal(publication.actionTarget, null);
  assert.equal(work.stage, "work_unpublished");
  assert.equal(work.actionTarget, "work");
  assert.equal(product.stage, "product_paused");
  assert.equal(product.actionTarget, "product");
  assert.equal(ready.stage, "ready");
  assert.equal(ready.ready, true);
});

test("Creator画面は販売下書き後の出品開始・再開と個別確認へ進める", async () => {
  const page = await read("src/app/creator/[projectId]/page.tsx");

  assert.match(page, /buildCloudMarketplaceSalesGuidance/);
  assert.match(page, /販売開始・再開までの進捗/);
  assert.match(page, /作品公開と販売開始・再開をまとめて確定/);
  assert.match(page, /出品を開始・再開する/);
  assert.match(page, /購入済みの利用権と注文履歴はそのまま維持されます/);
  assert.match(page, /作品設定を確認/);
  assert.match(page, /販売商品を確認/);
  assert.match(page, /\/dashboard\/works\/\$\{marketplaceDraft\.work\.id\}\/edit/);
  assert.match(page, /\/dashboard\/products\/\$\{marketplaceDraft\.product\.id\}\/edit/);
});

test("販売下書き後は販売準備欄へ戻り公開を自動実行しない", async () => {
  const actions = await read("src/app/creator/actions.ts");
  const functionStart = actions.indexOf(
    "export async function syncCloudMarketplaceDraftAction",
  );
  const functionEnd = actions.indexOf(
    "export async function startCloudPageGenerationBatchAction",
  );
  const functionSource = actions.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0);
  assert.ok(functionEnd > functionStart);
  assert.match(
    functionSource,
    /販売用の下書きを更新しました。内容を確認して出品を開始してください/,
  );
  assert.match(functionSource, /#marketplace-listing/);
  assert.doesNotMatch(functionSource, /publishCloudMarketplaceListing\(/);
});

test("販売下書き失敗は工程別の安全な案内と監査イベントを残す", async () => {
  const [actions, marketplace] = await Promise.all([
    read("src/app/creator/actions.ts"),
    read("src/lib/cloud-marketplace.ts"),
  ]);

  assert.match(actions, /cloud_marketplace_draft_sync_failed/);
  assert.match(actions, /checkpointId: parsed\.data\.checkpointId/);
  assert.match(marketplace, /販売用原稿の画像・PDFを作成できませんでした/);
  assert.match(marketplace, /販売用の表紙画像を保存できませんでした/);
  assert.match(marketplace, /販売用のPDFを保存できませんでした/);
  assert.match(marketplace, /販売用の作品・商品・完成版を保存できませんでした/);
  assert.doesNotMatch(marketplace, /throw new Error\(coverError\.message\)/);
  assert.doesNotMatch(marketplace, /throw new Error\(productUploadError\.message\)/);
});

test("出品開始・停止後も販売準備欄で最新状態を確認できる", async () => {
  const actions = await read("src/app/creator/actions.ts");
  const publishStart = actions.indexOf(
    "export async function publishCloudMarketplaceListingAction",
  );
  const withdrawStart = actions.indexOf(
    "export async function withdrawCloudMarketplaceListingAction",
  );
  const restoreStart = actions.indexOf(
    "export async function restoreCloudProjectCheckpointAction",
  );

  assert.ok(publishStart >= 0);
  assert.ok(withdrawStart > publishStart);
  assert.ok(restoreStart > withdrawStart);
  assert.match(actions.slice(publishStart, withdrawStart), /#marketplace-listing/);
  assert.match(actions.slice(withdrawStart, restoreStart), /#marketplace-listing/);
});

test("販売設定完了後は注文を作らず公開・購入準備画面を確認できる", async () => {
  const [page, buyerLinkActions] = await Promise.all([
    read("src/app/creator/[projectId]/page.tsx"),
    read("src/app/creator/[projectId]/MarketplaceBuyerLinkActions.tsx"),
  ]);

  assert.match(page, /marketplaceSalesGuidance\?\.ready && marketplaceDraft\.work/);
  assert.match(page, /画面を開くだけでは注文・決済は発生しません/);
  assert.match(page, /指定購入者へ購入準備URLを案内/);
  assert.match(page, /リンクを共有するだけでは購入資格は付与されず、注文・決済も発生しません/);
  assert.match(page, /checkoutPath=\{`\/checkout\/\$\{marketplaceDraft\.product\.id\}`\}/);
  assert.match(page, /公開作品ページを確認/);
  assert.match(page, /購入準備画面を確認/);
  assert.match(page, /注文・売上を確認/);
  assert.match(page, /\/works\/\$\{marketplaceDraft\.work\.id\}/);
  assert.match(page, /\/checkout\/\$\{marketplaceDraft\.product\.id\}/);
  assert.match(page, /\/dashboard\/sales/);
  assert.match(buyerLinkActions, /navigator\.share/);
  assert.match(buyerLinkActions, /navigator\.clipboard\?\.writeText/);
  assert.match(buyerLinkActions, /new URL\(checkoutPath, window\.location\.origin\)/);
  assert.doesNotMatch(buyerLinkActions, /create-session|orders|決済を開始/);
});
