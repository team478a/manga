import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("完成PDFと作品管理から外部出品マニュアルへ進める", async () => {
  const [exportPanel, worksPage, guide] = await Promise.all([
    readFile(
      new URL(
        "../src/app/creator/[projectId]/DurableExportPanel.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/app/dashboard/works/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/dashboard/monitor/guide/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  assert.match(exportPanel, /downloadablePdfAvailable/);
  assert.match(exportPanel, /job\.format === "pdf" && job\.downloadable/);
  assert.match(exportPanel, /次は外部販売サイトへの出品準備です/);
  assert.match(exportPanel, /出品・収益化の手順を見る/);
  assert.match(worksPage, /完成原稿を販売したい方へ/);
  assert.match(worksPage, /出品前チェックと登録手順を確認する/);

  for (const source of [exportPanel, worksPage]) {
    assert.match(source, /\/dashboard\/monitor\/guide#sales-listing/);
    assert.match(source, /MANGAI内の販売申請・決済・収益管理は準備中です/);
  }

  assert.match(guide, /id="sales-listing"/);
});
