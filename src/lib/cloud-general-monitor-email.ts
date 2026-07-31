import { getCloudGeneralMonitorEmailRuntimeConfig } from "./cloud-general-monitor-email-settings.ts";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

type InviteEmailInput = {
  recipientEmail: string;
  recipientName: string;
  expiresAt: string;
  aiRequestLimit: number;
};

function inviteSiteUrl() {
  const configured =
    process.env.MONITOR_INVITE_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!configured) throw new Error("monitor_invite_site_url_missing");
  const url = new URL("/dashboard/monitor/welcome", configured);
  if (
    url.protocol !== "https:" &&
    !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname))
  ) throw new Error("monitor_invite_site_url_invalid");
  return url.toString();
}

function formatFrom(fromEmail: string, fromName: string) {
  if (/<[^>]+>$/.test(fromEmail)) return fromEmail;
  return `${fromName} <${fromEmail}>`;
}

export async function cloudGeneralMonitorInviteEmailConfigured(
  loadConfig = getCloudGeneralMonitorEmailRuntimeConfig,
) {
  try {
    await loadConfig();
    inviteSiteUrl();
    return true;
  } catch {
    return false;
  }
}

export async function sendCloudGeneralMonitorInviteEmail(
  input: InviteEmailInput,
  request: typeof fetch = fetch,
  loadConfig = getCloudGeneralMonitorEmailRuntimeConfig,
) {
  const config = await loadConfig();
  const welcomeUrl = inviteSiteUrl();
  const expiry = new Date(input.expiresAt).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
  const greeting = input.recipientName.trim()
    ? `${input.recipientName.trim()} 様`
    : "MANGAIモニター様";
  const text = `${greeting}

MANGAI一般向けモニターへご招待しました。
登録済みのメールアドレスでログインし、初回案内をご確認ください。

利用開始: ${welcomeUrl}
利用期限: ${expiry}
AI利用上限: ${input.aiRequestLimit}回

このメールへパスワード、APIキー、個人情報を返信しないでください。`;
  const response = await request(RESEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: formatFrom(config.fromEmail, config.fromName),
      to: [input.recipientEmail],
      subject: "MANGAI 一般向けモニターのご案内",
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("monitor_invite_email_send_failed");
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  return { messageId: typeof result?.id === "string" ? result.id : null };
}
