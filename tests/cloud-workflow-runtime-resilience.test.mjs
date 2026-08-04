import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("制作ワークフローの補助読込は個別にフォールバックする", async () => {
  const pages = await Promise.all([
    read("src/app/dashboard/research/[reportId]/proposal/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx"),
  ]);

  for (const source of pages) {
    assert.match(source, /safelyLoadCloudData/);
    assert.match(source, /CloudDataNotice/);
  }
  assert.doesNotMatch(pages[2], /await Promise\.all\(\[\s*listCloudScenarioVersions/);
  assert.doesNotMatch(pages[4], /await Promise\.all\(\[\s*listCloudStoryboardVersions/);
});

test("補助状態を確認できない間は重複生成と採用を停止する", async () => {
  const [proposal, scenario, storyboard, version] = await Promise.all([
    read("src/app/dashboard/research/[reportId]/proposal/runs/[runId]/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/page.tsx"),
    read("src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/versions/[storyboardVersionId]/page.tsx"),
  ]);
  assert.match(proposal, /selectionLoad\.ok && !selection/);
  assert.match(scenario, /!versionLoad\.ok \? null/);
  assert.match(storyboard, /!scenarioAdoptionLoad\.ok \|\| !versionLoad\.ok \? null/);
  assert.match(version, /!workflowStateAvailable/);
});

test("Creatorは一時障害を存在しない作品として扱わない", async () => {
  const [boundary, project, canvas, service] = await Promise.all([
    read("src/app/creator/error.tsx"),
    read("src/app/creator/[projectId]/page.tsx"),
    read("src/app/creator/[projectId]/pages/[pageId]/page.tsx"),
    read("src/modules/cloud-creator/projects/project-service.ts"),
  ]);
  assert.match(boundary, /制作画面を読み込めませんでした/);
  assert.match(boundary, /作品データは失われていません/);
  assert.match(project, /instanceof ResourceNotFoundError/);
  assert.match(canvas, /instanceof ResourceNotFoundError/);
  assert.match(service, /if \(projectError\)[\s\S]*"INTERNAL_ERROR"/);
  assert.match(service, /if \(!project\)[\s\S]*ResourceNotFoundError/);
});

test("参照設定とモニター履歴は部分障害でも主要画面を残す", async () => {
  const [references, characters, bible, monitor] = await Promise.all([
    read("src/app/creator/[projectId]/references/page.tsx"),
    read("src/app/creator/[projectId]/characters/page.tsx"),
    read("src/app/creator/[projectId]/bible/page.tsx"),
    read("src/app/dashboard/monitor/page.tsx"),
  ]);
  assert.match(references, /Promise\.allSettled/);
  assert.match(references, /panelsUnavailable/);
  assert.match(characters, /resultLoad\.ok/);
  assert.match(bible, /resultLoad\.ok/);
  assert.match(monitor, /feedbackLoad/);
  assert.match(monitor, /新しい報告はそのまま送信できます/);
});

test("共通loaderは内部情報を利用者へ返さず安全な識別子だけを記録する", async () => {
  const helper = await read("src/lib/cloud-runtime-resilience.ts");
  assert.match(helper, /logHubError\("cloud_data_load_failed", error, \{ scope \}\)/);
  assert.match(helper, /shouldRethrow/);
  assert.doesNotMatch(helper, /error\.message/);
});
