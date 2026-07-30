import assert from "node:assert/strict";
import test from "node:test";
import {
  cloudGeneralMonitorInviteEmailConfigured,
  sendCloudGeneralMonitorInviteEmail,
} from "../src/lib/cloud-general-monitor-email.ts";

const resendEnvironmentKeys = [
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "RESEND_FROM_NAME",
  "EMAIL_FROM",
  "MONITOR_INVITE_FROM_EMAIL",
  "MONITOR_INVITE_FROM_NAME",
  "MONITOR_INVITE_SITE_URL",
];

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
    RESEND_API_KEY: "secret-token",
    RESEND_FROM_EMAIL: "monitor@mang-ai.example",
    RESEND_FROM_NAME: "MANGAI運営",
    MONITOR_INVITE_SITE_URL: "https://preview.mang-ai.example",
  });
  let captured;
  const request = async (url, init) => {
    captured = { url, init };
    return Response.json({ id: "message-1" }, {
      status: 200,
    });
  };
  try {
    assert.equal(cloudGeneralMonitorInviteEmailConfigured(), true);
    const result = await sendCloudGeneralMonitorInviteEmail({
      recipientEmail: "reader@example.com",
      recipientName: "山田",
      expiresAt: "2026-08-31T00:00:00.000Z",
      aiRequestLimit: 30,
    }, request);
    assert.equal(result.messageId, "message-1");
    assert.equal(captured.url, "https://api.resend.com/emails");
    const body = JSON.parse(captured.init.body);
    assert.equal(body.from, "MANGAI運営 <monitor@mang-ai.example>");
    assert.equal(body.to[0], "reader@example.com");
    assert.match(body.text, /https:\/\/preview\.mang-ai\.example\/dashboard\/monitor\/welcome/);
    assert.doesNotMatch(body.text, /secret-token/);
    assert.equal(captured.init.headers.Authorization, "Bearer secret-token");
  } finally {
    restoreEnvironment(previous);
  }
});

test("Providerエラー本文を上位へ露出しない", async () => {
  const previous = preserveEnvironment();
  try {
    Object.assign(process.env, {
      RESEND_API_KEY: "secret-token",
      RESEND_FROM_EMAIL: "monitor@mang-ai.example",
      MONITOR_INVITE_SITE_URL: "https://preview.mang-ai.example",
    });
    await assert.rejects(
      sendCloudGeneralMonitorInviteEmail({
        recipientEmail: "reader@example.com",
        recipientName: "",
        expiresAt: "2026-08-31T00:00:00.000Z",
        aiRequestLimit: 10,
      }, async () => new Response('{"message":"provider-secret-detail"}', { status: 422 })),
      (error) => error.message === "monitor_invite_email_send_failed",
    );
  } finally {
    restoreEnvironment(previous);
  }
});
