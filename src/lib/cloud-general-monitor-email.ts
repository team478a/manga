const MAILERSEND_EMAIL_ENDPOINT = "https://api.mailersend.com/v1/email";

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

export function cloudGeneralMonitorInviteEmailConfigured() {
  return Boolean(
    process.env.MAILERSEND_API_TOKEN?.trim() &&
    process.env.MONITOR_INVITE_FROM_EMAIL?.trim() &&
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
  const token = process.env.MAILERSEND_API_TOKEN?.trim();
  const fromEmail = process.env.MONITOR_INVITE_FROM_EMAIL?.trim();
  const fromName = process.env.MONITOR_INVITE_FROM_NAME?.trim() || "MANGAI運営";
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
  const response = await request(MAILERSEND_EMAIL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from: { email: fromEmail, name: fromName },
      to: [{ email: input.recipientEmail, name: input.recipientName }],
      subject: "MANGAI 一般向けモニターのご案内",
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("monitor_invite_email_send_failed");
  return { messageId: response.headers.get("x-message-id") };
}
