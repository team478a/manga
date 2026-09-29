import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("完成PDFと作品管理から限定テスト販売・外部出品マニュアルへ進める", async () => {
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
  assert.match(exportPanel, /次は販売方法を選びます/);
  assert.match(exportPanel, /MANGAI内テスト販売の手順/);
  assert.match(exportPanel, /外部出品の手順/);
  assert.match(worksPage, /完成原稿を販売したい方へ/);
  assert.match(worksPage, /MANGAI内テスト販売の手順/);
  assert.match(worksPage, /外部出品の手順/);

  assert.match(exportPanel, /\/dashboard\/monitor\/guide#sales-listing/);
  assert.match(exportPanel, /\/dashboard\/monitor\/guide#internal-test-sale/);
  assert.match(exportPanel, /一般公開販売・振込・精算確定は準備中/);
  assert.match(worksPage, /\/dashboard\/monitor\/guide#sales-listing/);
  assert.match(worksPage, /\/dashboard\/monitor\/guide#internal-test-sale/);
  assert.match(worksPage, /一般公開販売・振込・精算確定は準備中/);

  assert.match(guide, /id="internal-test-sale"/);
  assert.match(guide, /id="sales-listing"/);
});

test("Creator販売設定完了後は限定テスト販売の手順へ進める", async () => {
  const creatorProject = await readFile(
    new URL("../src/app/creator/[projectId]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(creatorProject, /テスト販売の手順/);
  assert.match(
    creatorProject,
    /\/dashboard\/monitor\/guide#internal-test-sale/,
  );
  assert.match(creatorProject, /marketplaceSalesGuidance\?\.ready/);
});
