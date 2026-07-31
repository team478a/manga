import {
  getCloudAdultMonitorEmailRuntimeConfig,
  getCloudGeneralMonitorEmailRuntimeConfig,
} from "./cloud-general-monitor-email-settings.ts";

const RESEND_EMAIL_ENDPOINT = "https://api.resend.com/emails";

type InviteEmailInput = {
  recipientEmail: string;
  recipientName: string;
  expiresAt: string;
  aiRequestLimit: number;
};

type InviteKind = "general" | "adult";

type InviteTemplateValues = {
  recipientName: string;
  welcomeUrl: string;
  expiresOn: string;
  aiRequestLimit: number;
};

export function renderCloudGeneralMonitorInviteTemplate(
  template: string,
  values: InviteTemplateValues,
) {
  const replacements: Record<string, string> = {
    "{{recipient_name}}": values.recipientName,
    "{{welcome_url}}": values.welcomeUrl,
    "{{expires_on}}": values.expiresOn,
    "{{ai_request_limit}}": String(values.aiRequestLimit),
  };
  return Object.entries(replacements).reduce(
    (rendered, [placeholder, value]) =>
      rendered.replaceAll(placeholder, value),
    template,
  );
}

function inviteSiteUrl(kind: InviteKind = "general") {
  const configured =
    process.env.MONITOR_INVITE_SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  if (!configured) throw new Error("monitor_invite_site_url_missing");
  const url = new URL(
    kind === "adult"
      ? "/dashboard/adult-monitor/welcome"
      : "/dashboard/monitor/welcome",
    configured,
  );
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
  const templateValues = {
    recipientName: greeting,
    welcomeUrl,
    expiresOn: expiry,
    aiRequestLimit: input.aiRequestLimit,
  };
  const subject = renderCloudGeneralMonitorInviteTemplate(
    config.subjectTemplate,
    templateValues,
  );
  const text = renderCloudGeneralMonitorInviteTemplate(
    config.bodyTemplate,
    templateValues,
  );
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
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("monitor_invite_email_send_failed");
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  return { messageId: typeof result?.id === "string" ? result.id : null };
}

export async function sendCloudAdultMonitorInviteEmail(
  input: InviteEmailInput,
  request: typeof fetch = fetch,
  loadConfig = getCloudAdultMonitorEmailRuntimeConfig,
) {
  const config = await loadConfig();
  const welcomeUrl = inviteSiteUrl("adult");
  const expiry = new Date(input.expiresAt).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
  });
  const values = {
    recipientName: input.recipientName.trim()
      ? `${input.recipientName.trim()} 様`
      : "MANGAIモニター様",
    welcomeUrl,
    expiresOn: expiry,
    aiRequestLimit: input.aiRequestLimit,
  };
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
      subject: renderCloudGeneralMonitorInviteTemplate(
        config.subjectTemplate,
        values,
      ),
      text: renderCloudGeneralMonitorInviteTemplate(config.bodyTemplate, values),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("adult_monitor_invite_email_send_failed");
  const result = await response.json().catch(() => null) as { id?: unknown } | null;
  return { messageId: typeof result?.id === "string" ? result.id : null };
}
