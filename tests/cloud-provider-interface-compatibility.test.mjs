import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("共通Provider interfaceは既存generate/cancelを保持してoptional拡張する", async () => {
  const source = await readFile("packages/ai-core/src/cloud-generation.ts", "utf8");
  assert.match(source, /generatePanel\?\(/);
  assert.match(source, /editRegion\?\(/);
  assert.match(source, /estimateCost\?\(/);
  assert.match(source, /cancelProviderJob\?\(/);
  assert.match(source, /\n  generate\(/);
  assert.match(source, /\n  cancel\?\(/);
});

test("既存画像adapterはProvider通信を増やさずgenerateへ委譲する", async () => {
  for (const file of ["mock-provider.ts", "gateway-provider.ts", "bfl-provider.ts"]) {
    const source = await readFile(`src/modules/cloud-ai/infrastructure/${file}`, "utf8");
    assert.match(source, /capabilities\(\).*return this\.capability/);
    assert.match(source, /generatePanel[\s\S]{0,300}return this\.generate\(input, context/);
  }
});
