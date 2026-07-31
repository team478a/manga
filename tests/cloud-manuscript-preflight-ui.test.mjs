import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const page = fs.readFileSync("src/app/creator/[projectId]/page.tsx", "utf8");
const service = fs.readFileSync(
  "src/modules/cloud-creator/projects/manuscript-preflight-service.ts",
  "utf8",
);

test("作品画面は原稿チェックと修正先への導線を表示する", () => {
  assert.match(page, /原稿チェック/);
  assert.match(page, /8ページ基準/);
  assert.match(page, /画像配置済みコマ/);
  assert.match(page, /書き出し準備完了/);
  assert.match(page, /issue\.pageId/);
});

test("原稿チェックは所有者RLS対象のCanvasとAssetメタデータだけを読む", () => {
  assert.match(service, /cloudCreatorContext/);
  assert.match(service, /cloud_canvas_snapshots/);
  assert.match(service, /cloud_assets/);
  assert.doesNotMatch(service, /storage[\s\S]*download|service.?role/i);
});
