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

function inviteFromEmail() {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.MONITOR_INVITE_FROM_EMAIL?.trim()
  );
}

function inviteFromName() {
  return (
    process.env.RESEND_FROM_NAME?.trim() ||
    process.env.MONITOR_INVITE_FROM_NAME?.trim() ||
    "MANGAI運営"
  );
}

function formatFrom(fromEmail: string) {
  if (/<[^>]+>$/.test(fromEmail)) return fromEmail;
  return `${inviteFromName()} <${fromEmail}>`;
}

export function cloudGeneralMonitorInviteEmailConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() &&
    inviteFromEmail() &&
    (
      process.env.MONITOR_INVITE_SITE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      process.env.VERCEL_URL?.trim()
    ),
  );
}

export async function sendCloudGeneralMonitorInviteEmail(
  input: InviteEmailInput,
  request: typeof fetch = fetch,
) {
  const token = process.env.RESEND_API_KEY?.trim();
  const fromEmail = inviteFromEmail();
  if (!token || !fromEmail) throw new Error("monitor_invite_email_not_configured");
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
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: formatFrom(fromEmail),
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
