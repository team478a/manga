import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("共通送信ボタンは処理中表示と二重送信防止を提供する", async () => {
  const source = await readFile(
    new URL("../src/components/PendingSubmitButton.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /useFormStatus/);
  assert.match(source, /aria-busy=\{pending\}/);
  assert.match(source, /disabled=\{isDisabled\}/);
  assert.match(source, /animate-spin/);
  assert.match(source, /pendingLabel/);
});

test("市場分析からネームまでのAI送信操作は共通pending境界を使う", async () => {
  const paths = [
    "../src/app/dashboard/research/new/research-submit-button.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/proposal-submit-button.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/scenario-buttons.tsx",
    "../src/app/dashboard/research/[reportId]/proposal/scenario/versions/[versionId]/storyboard/storyboard-button.tsx",
  ];
  const sources = await Promise.all(
    paths.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const [index, source] of sources.entries()) {
    assert.match(source, /PendingSubmitButton/, paths[index]);
    assert.doesNotMatch(source, /useFormStatus/, paths[index]);
  }

  assert.match(sources[0], /pendingLabel="AIが売れ筋を調査しています…"/);
  assert.match(sources[0], /どんな作品が売れやすいか調べる/);
  assert.match(sources[0], /button w-full bg-violet-700 hover:bg-violet-800/);
  assert.match(sources[1], /pendingLabel="AIが企画を作成中…"/);
  assert.match(sources[1], /pendingLabel="企画を保存中…"/);
  assert.match(sources[1], /AI企画を3案作成/);
  assert.match(sources[1], /この企画で進める/);
  assert.match(sources[2], /pendingLabel="AIがシナリオを作成中…"/);
  assert.match(sources[2], /secondary \? "button-secondary"/);
  assert.match(sources[3], /pendingLabel="AIがネームを作成中…"/);
  assert.match(sources[3], /secondary \? "button-secondary"/);
});

test("モニター運用の送信操作は用途別の処理中表示を使う", async () => {
  const [user, monitors, email, providers, dashboard, welcome] = await Promise.all([
    readFile(new URL("../src/app/admin/users/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/admin/general-monitors/email/page.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../src/app/admin/provider-settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/dashboard/monitor/MonitorFeedbackForm.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/dashboard/monitor/welcome/MonitorStartButton.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(user, /招待メールを送信中…/);
  assert.match(user, /招待処理中…/);
  assert.match(user, /停止処理中…/);
  assert.match(monitors, /更新中…/);
  assert.match(email, /文面を保存中…/);
  assert.match(providers, /Resend設定を保存中…/);
  assert.match(dashboard, /報告を安全に送信中…/);
  assert.match(welcome, /開始準備中…/);
});
