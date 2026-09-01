import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const runbookPath = path.resolve(
  here,
  "../../../docs/desktop/DESKTOP_ADULT_PILOT_STOP_RECOVERY_RUNBOOK_20260901.md",
);
const runbook = fs.readFileSync(runbookPath, "utf8");

test("Adult Pilot停止・復旧ランブックが公開前の必須運用を網羅する", () => {
  for (const heading of [
    "緊急停止手順",
    "作品データ保持とバックアップ",
    "アンインストール手順",
    "問い合わせ受付",
    "復旧と配布再開",
    "停止通知テンプレート",
  ]) {
    assert.match(runbook, new RegExp(`## \\d+\\. ${heading}`));
  }
  assert.match(runbook, /遠隔強制停止／version失効機構は未実装/);
  assert.match(runbook, /Project、素材、Page、backupを自動削除しない/);
  assert.match(runbook, /Production、Cloud、Provider、credit/);
});

test("停止手順が破壊的な一括削除や秘密情報収集を指示しない", () => {
  assert.doesNotMatch(runbook, /rm\s+-rf|Remove-Item\s+.*-Recurse|rmdir\s+\/s/i);
  assert.match(runbook, /Prompt、画像、作品名/);
  assert.match(runbook, /絶対pathは送らない/);
});
