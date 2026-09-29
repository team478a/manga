import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { assessCloudMarketplaceProductEdit } from "../src/lib/cloud-marketplace-product-edit.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const base = {
  sourceProjectId: "project-1",
  current: { workId: "work-1", price: 1200, status: "active" },
  proposed: {
    workId: "work-1",
    price: 1200,
    replacesFile: false,
    status: "active",
  },
};

test("販売中Cloud商品は説明変更相当だけを許可する", () => {
  assert.deepEqual(assessCloudMarketplaceProductEdit(base), {
    allowed: true,
    cloudLinked: true,
    reason: null,
  });
});

test("販売中Cloud商品の価格・作品・file・状態変更を拒否する", () => {
  for (const proposed of [
    { ...base.proposed, price: 1300 },
    { ...base.proposed, workId: "work-2" },
    { ...base.proposed, replacesFile: true },
    { ...base.proposed, status: "paused" },
  ]) {
    const result = assessCloudMarketplaceProductEdit({ ...base, proposed });
    assert.equal(result.allowed, false);
    assert.equal(result.cloudLinked, true);
    assert.ok(result.reason);
  }
});

test("停止中Cloud商品は価格変更を許可し状態再開はCreatorへ限定する", () => {
  const paused = {
    ...base,
    current: { ...base.current, status: "paused" },
    proposed: { ...base.proposed, price: 1300, status: "paused" },
  };
  assert.equal(assessCloudMarketplaceProductEdit(paused).allowed, true);
  assert.equal(
    assessCloudMarketplaceProductEdit({
      ...paused,
      proposed: { ...paused.proposed, status: "active" },
    }).allowed,
    false,
  );
});

test("手動登録商品は従来の編集を維持する", () => {
  const result = assessCloudMarketplaceProductEdit({
    ...base,
    sourceProjectId: null,
    proposed: {
      workId: "work-2",
      price: 1300,
      replacesFile: true,
      status: "paused",
    },
  });
  assert.deepEqual(result, { allowed: true, cloudLinked: false, reason: null });
});

test("商品編集画面とActionはCloud固定項目を二重に保護する", async () => {
  const [page, actions] = await Promise.all([
    read("src/app/dashboard/products/[id]/edit/page.tsx"),
    read("src/app/actions/product-actions.ts"),
  ]);
  assert.match(page, /Cloud連携商品の固定項目を保護しています/);
  assert.match(page, /Creator作品画面を開く/);
  assert.match(page, /販売中は価格も固定されます/);
  assert.match(page, /固定完成版PDFと同期/);
  assert.match(actions, /assessCloudMarketplaceProductEdit/);
  assert.match(actions, /productFileValue instanceof File/);
  assert.match(actions, /revalidatePath\(`\/checkout\/\$\{id\}`\)/);
});
