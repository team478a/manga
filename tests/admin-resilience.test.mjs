import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("管理画面全体は予期しない障害を日本語の回復画面へ変換する", async () => {
  const [boundary, fallback, helper] = await Promise.all([
    read("src/app/admin/error.tsx"),
    read("src/components/admin/AdminDataUnavailable.tsx"),
    read("src/lib/admin-resilience.ts"),
  ]);

  assert.match(boundary, /管理画面を読み込めませんでした/);
  assert.match(boundary, /onClick=\{reset\}/);
  assert.match(boundary, /href="\/admin"/);
  assert.doesNotMatch(boundary, /error\.message/);
  assert.match(fallback, /一時的に管理データへ接続できませんでした/);
  assert.match(fallback, /window\.location\.reload/);
  assert.match(helper, /catch \(error\)/);
  assert.match(helper, /error instanceof Error \? error\.name/);
  assert.doesNotMatch(helper, /error\.message/);
});

test("接続依存の強い管理ページは安全な読み込みを使用する", async () => {
  const pages = [
    "src/app/admin/adult-research/page.tsx",
    "src/app/admin/cloud-ai/page.tsx",
    "src/app/admin/general-monitors/page.tsx",
    "src/app/admin/general-monitors/email/page.tsx",
    "src/app/admin/monitor-issues/page.tsx",
    "src/app/admin/provider-settings/page.tsx",
    "src/app/admin/users/page.tsx",
    "src/app/admin/users/[id]/page.tsx",
  ];

  for (const path of pages) {
    const source = await read(path);
    assert.match(source, /safelyLoadAdminData/, path);
    assert.match(source, /AdminDataUnavailable/, path);
  }
});

test("添付URLとCSVの障害は管理画面全体を停止させない", async () => {
  const [monitors, issues, csv] = await Promise.all([
    read("src/app/admin/general-monitors/page.tsx"),
    read("src/app/admin/monitor-issues/page.tsx"),
    read("src/app/admin/general-monitors/export/route.ts"),
  ]);

  assert.match(monitors, /Promise\.allSettled/);
  assert.match(issues, /Promise\.allSettled/);
  assert.match(csv, /catch \(error\)/);
  assert.match(csv, /status:503/);
  assert.doesNotMatch(csv, /error\.message/);
});

test("重要な管理更新操作はProvider例外を利用者向け案内へ変換する", async () => {
  const actions = await Promise.all([
    read("src/app/admin/adult-research/actions.ts"),
    read("src/app/admin/general-monitors/actions.ts"),
    read("src/app/admin/monitor-issues/actions.ts"),
    read("src/app/admin/users/account-actions.ts"),
    read("src/app/admin/users/[id]/adult-feature-actions.ts"),
    read("src/app/admin/users/[id]/adult-research-actions.ts"),
  ]);

  for (const source of actions) {
    assert.match(source, /safelyLoadAdminData/);
    assert.doesNotMatch(source, /error\.message/);
  }
});
