import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  cloudGeneralMonitorInviteEmailConfigured,
  renderCloudGeneralMonitorInviteTemplate,
  sendCloudGeneralMonitorInviteEmail,
} from "../src/lib/cloud-general-monitor-email.ts";
import {
  DEFAULT_MONITOR_INVITE_BODY,
  DEFAULT_MONITOR_INVITE_SUBJECT,
} from "../src/lib/cloud-general-monitor-email-settings.ts";

const resendEnvironmentKeys = ["MONITOR_INVITE_SITE_URL"];

function preserveEnvironment() {
  return Object.fromEntries(resendEnvironmentKeys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(previous) {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

test("Resend招待メールはServer設定と安全な利用開始URLだけを送る", async () => {
  const previous = preserveEnvironment();
  Object.assign(process.env, {
    MONITOR_INVITE_SITE_URL: "https://preview.mang-ai.example",
  });
  const loadConfig = async () => ({
    apiKey: "re_secret-token-for-test",
    fromEmail: "monitor@mang-ai.example",
    fromName: "MANGAI運営",
    subjectTemplate: DEFAULT_MONITOR_INVITE_SUBJECT,
    bodyTemplate: DEFAULT_MONITOR_INVITE_BODY,
  });
  let captured;
  const request = async (url, init) => {
    captured = { url, init };
    return Response.json({ id: "message-1" }, {
      status: 200,
    });
  };
  try {
    assert.equal(
      await cloudGeneralMonitorInviteEmailConfigured(loadConfig),
      true,
    );
    const result = await sendCloudGeneralMonitorInviteEmail({
      recipientEmail: "reader@example.com",
      recipientName: "山田",
      expiresAt: "2026-08-31T00:00:00.000Z",
      aiRequestLimit: 30,
    }, request, loadConfig);
    assert.equal(result.messageId, "message-1");
    assert.equal(captured.url, "https://api.resend.com/emails");
    const body = JSON.parse(captured.init.body);
    assert.equal(body.from, "MANGAI運営 <monitor@mang-ai.example>");
    assert.equal(body.to[0], "reader@example.com");
    assert.equal(body.subject, "MANGAI 一般向けモニターのご案内");
    assert.match(body.text, /山田 様/);
    assert.match(body.text, /https:\/\/preview\.mang-ai\.example\/dashboard\/monitor\/welcome/);
    assert.doesNotMatch(body.text, /secret-token/);
    assert.equal(
      captured.init.headers.Authorization,
      "Bearer re_secret-token-for-test",
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("Providerエラー本文を上位へ露出しない", async () => {
  const previous = preserveEnvironment();
  try {
    Object.assign(process.env, {
      MONITOR_INVITE_SITE_URL: "https://preview.mang-ai.example",
    });
    const loadConfig = async () => ({
      apiKey: "re_secret-token-for-test",
      fromEmail: "monitor@mang-ai.example",
      fromName: "MANGAI運営",
      subjectTemplate: DEFAULT_MONITOR_INVITE_SUBJECT,
      bodyTemplate: DEFAULT_MONITOR_INVITE_BODY,
    });
    await assert.rejects(
      sendCloudGeneralMonitorInviteEmail(
        {
          recipientEmail: "reader@example.com",
          recipientName: "",
          expiresAt: "2026-08-31T00:00:00.000Z",
          aiRequestLimit: 10,
        },
        async () =>
          new Response('{"message":"provider-secret-detail"}', { status: 422 }),
        loadConfig,
      ),
      (error) => error.message === "monitor_invite_email_send_failed",
    );
  } finally {
    restoreEnvironment(previous);
  }
});

test("管理画面で保存した件名と本文へ安全な差し込み値を反映する", () => {
  const rendered = renderCloudGeneralMonitorInviteTemplate(
    "{{recipient_name}} / {{expires_on}} / {{ai_request_limit}} / {{welcome_url}}",
    {
      recipientName: "田中 様",
      welcomeUrl: "https://app.mang-ai.com/dashboard/monitor/welcome",
      expiresOn: "2026/08/31",
      aiRequestLimit: 30,
    },
  );
  assert.equal(
    rendered,
    "田中 様 / 2026/08/31 / 30 / https://app.mang-ai.com/dashboard/monitor/welcome",
  );
});

test("Resend APIキーは管理画面からVaultへ保存し再表示しない", async () => {
  const [page, action, settings, migration, templateMigration, example] = await Promise.all([
    readFile(
      new URL(
        "../src/app/admin/general-monitors/email/page.tsx",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/app/admin/general-monitors/email/actions.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../src/lib/cloud-general-monitor-email-settings.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607310002_cloud_general_monitor_email_provider.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607310003_cloud_general_monitor_email_template.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(page, /type="password"/);
  assert.match(page, /APIキーを保存して利用開始/);
  assert.doesNotMatch(page, /settings\.apiKey/);
  assert.match(action, /setCloudGeneralMonitorEmailSettings/);
  assert.match(settings, /set_cloud_general_monitor_email_provider/);
  assert.match(settings, /get_cloud_general_monitor_email_runtime_config/);
  assert.match(page, /招待メールの文面/);
  assert.match(page, /subjectTemplate/);
  assert.match(page, /bodyTemplate/);
  assert.match(page, /\{\{welcome_url\}\}/);
  assert.match(action, /updateGeneralMonitorEmailTemplateAction/);
  assert.match(action, /value\.includes\("\{\{welcome_url\}\}"\)/);
  assert.match(settings, /set_cloud_general_monitor_email_template/);
  assert.match(migration, /vault\.create_secret/);
  assert.match(migration, /vault\.update_secret/);
  assert.match(migration, /auth\.role\(\)<>'service_role'/);
  assert.match(templateMigration, /set_cloud_general_monitor_email_template/);
  assert.match(templateMigration, /update_template/);
  assert.match(templateMigration, /\{\{welcome_url\}\}/);
  assert.doesNotMatch(example, /RESEND_API_KEY|RESEND_FROM_EMAIL|RESEND_FROM_NAME/);
});
