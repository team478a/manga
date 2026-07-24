import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { persistWithCompensation } from "../src/app/actions/shared/compensating-transaction.ts";

test("DB確定成功時はStorage補償を実行しない", async () => {
  let compensations = 0;
  const result = await persistWithCompensation({
    persist: async () => ({ data: { id: "work-1" }, error: null }),
    compensate: async () => {
      compensations += 1;
    },
  });
  assert.equal(result.data.id, "work-1");
  assert.equal(compensations, 0);
});

test("DB error結果ではStorage補償を一度実行する", async () => {
  let compensations = 0;
  const databaseError = new Error("insert failed");
  const result = await persistWithCompensation({
    persist: async () => ({ data: null, error: databaseError }),
    compensate: async () => {
      compensations += 1;
    },
  });
  assert.equal(result.error, databaseError);
  assert.equal(compensations, 1);
});

test("DB例外ではStorage補償後に元の例外を再送出する", async () => {
  let compensations = 0;
  const databaseError = new Error("network lost");
  await assert.rejects(
    persistWithCompensation({
      persist: async () => {
        throw databaseError;
      },
      compensate: async () => {
        compensations += 1;
      },
    }),
    databaseError,
  );
  assert.equal(compensations, 1);
});

test("Storage補償自体の失敗でも補償を重複実行しない", async () => {
  let compensations = 0;
  await assert.rejects(
    persistWithCompensation({
      persist: async () => ({ error: new Error("insert failed") }),
      compensate: async () => {
        compensations += 1;
        throw new Error("cleanup failed");
      },
    }),
    /cleanup failed/,
  );
  assert.equal(compensations, 1);
});

test("互換entrypointはasync Actionだけを委譲しStorageへ触れない", async () => {
  const source = await readFile(
    new URL("../src/app/actions.ts", import.meta.url),
    "utf8",
  );
  assert.ok(source.split(/\r?\n/).length < 100);
  assert.doesNotMatch(source, /createClient|storage\.|\.from\(/);
  for (const action of [
    "signUp",
    "signIn",
    "updateProfile",
    "createWork",
    "updateWork",
    "createDigitalProduct",
    "updateDigitalProduct",
    "createGoodsRequest",
    "updateGoodsRequestAdmin",
    "createPendingOrder",
  ]) {
    assert.match(source, new RegExp(`\\b${action}\\b`));
  }
});

test("作品と商品Actionは共通Storage transactionを利用する", async () => {
  for (const relative of [
    "../src/app/actions/work-actions.ts",
    "../src/app/actions/product-actions.ts",
  ]) {
    const source = await readFile(new URL(relative, import.meta.url), "utf8");
    assert.match(source, /uploadMarketplaceFile/);
    assert.match(source, /persistWithStorageRollback/);
    assert.doesNotMatch(source, /storage\.from\([^)]*\)\.upload/);
  }
});
