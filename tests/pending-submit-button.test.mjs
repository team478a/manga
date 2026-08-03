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

test("モニター運用の送信操作は用途別の処理中表示を使う", async () => {
  const [user, monitors, email, dashboard, welcome] = await Promise.all([
    readFile(new URL("../src/app/admin/users/[id]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/admin/general-monitors/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../src/app/admin/general-monitors/email/page.tsx", import.meta.url),
      "utf8",
    ),
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
  assert.match(email, /設定を保存中…/);
  assert.match(dashboard, /報告を安全に送信中…/);
  assert.match(welcome, /開始準備中…/);
});
