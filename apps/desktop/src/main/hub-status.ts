import { z } from "zod";

const hubStatusResponseSchema = z.discriminatedUnion("linked", [
  z.object({
    linked: z.literal(true),
    projectId: z.string().uuid(),
    work: z.object({
      id: z.string().uuid(),
      title: z.string(),
      description: z.string(),
      status: z.enum(["draft", "published", "archived"]),
      isPublic: z.boolean(),
      updatedAt: z.string(),
      path: z.string().startsWith("/"),
      canWriteDraft: z.boolean(),
    }),
    sales: z.object({
      activeProductCount: z.number().int().nonnegative(),
      pausedProductCount: z.number().int().nonnegative(),
      available: z.boolean(),
    }),
  }),
  z.object({
    linked: z.literal(false),
    message: z.string(),
  }),
]);

export type HubStatus = z.infer<typeof hubStatusResponseSchema>;

const deviceStartResponseSchema = z.object({
  status: z.literal("pending"),
  deviceToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  userCode: z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/),
  verificationPath: z.string().startsWith("/"),
  expiresAt: z.string(),
  intervalSeconds: z.number().int().min(5).max(60),
});
const devicePollResponseSchema = z.object({
  status: z.enum(["pending", "approved", "denied", "expired", "revoked"]),
  approvedAt: z.string().nullable().optional(),
  tokenExpiresAt: z.string().nullable().optional(),
  scopes: z.array(z.string()).optional(),
});
export type HubDeviceStart = z.infer<typeof deviceStartResponseSchema>;
export type HubDevicePoll = z.infer<typeof devicePollResponseSchema>;

export function normalizeHubBaseUrl(value: string) {
  const url = new URL(value);
  const localHost =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && localHost))
    throw new Error(
      "Hub URLはHTTPSを指定してください（localhostのみHTTPを利用できます）。",
    );
  if (url.username || url.password)
    throw new Error("認証情報を含むHub URLは指定できません。");
  if (url.search || url.hash)
    throw new Error("Hub URLにクエリまたはフラグメントは指定できません。");
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export async function fetchHubStatus(
  projectId: string,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
  deviceToken?: string,
): Promise<HubStatus> {
  const normalizedBaseUrl = normalizeHubBaseUrl(baseUrl);
  const endpoint = `${normalizedBaseUrl}/api/desktop/projects/${encodeURIComponent(projectId)}/status`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(deviceToken ? { authorization: `Bearer ${deviceToken}` } : {}),
      },
      redirect: "error",
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 404) {
      return hubStatusResponseSchema.parse(
        body ?? { linked: false, message: "公開作品は見つかりません。" },
      );
    }
    if (!response.ok)
      throw new Error(
        response.status === 503
          ? "Hubが公開状況を確認できませんでした。"
          : `Hubとの通信に失敗しました（HTTP ${response.status}）。`,
      );
    return hubStatusResponseSchema.parse(body);
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError")
      throw new Error("Hubへの接続がタイムアウトしました。");
    if (cause instanceof z.ZodError)
      throw new Error("Hubから不正な応答を受信しました。");
    throw cause;
  } finally {
    clearTimeout(timeout);
  }
}

export async function startHubDeviceAuthorization(
  baseUrl: string,
  deviceName: string,
  fetcher: typeof fetch = fetch,
): Promise<HubDeviceStart> {
  const response = await fetcher(
    `${normalizeHubBaseUrl(baseUrl)}/api/desktop/device/authorize`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        deviceName,
        scopes: ["works:read", "works:write:draft"],
      }),
      redirect: "error",
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: unknown;
    } | null;
    if (response.status === 429 && typeof body?.message === "string")
      throw new Error(body.message);
    throw new Error("Hubで端末認証を開始できませんでした。");
  }
  try {
    return deviceStartResponseSchema.parse(await response.json());
  } catch {
    throw new Error("Hubから不正な端末認証応答を受信しました。");
  }
}

const hubDraftUpdateResponseSchema = z.object({
  updated: z.literal(true),
  work: z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string(),
    updatedAt: z.string(),
  }),
});

export async function updateHubDraft(
  projectId: string,
  baseUrl: string,
  input: { title: string; description: string; expectedUpdatedAt: string },
  deviceToken: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    `${normalizeHubBaseUrl(baseUrl)}/api/desktop/projects/${encodeURIComponent(projectId)}/status`,
    {
      method: "PATCH",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${deviceToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      redirect: "error",
    },
  );
  const body = (await response.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  if (!response.ok) {
    if (typeof body?.message === "string") throw new Error(body.message);
    throw new Error(`Hub下書きを更新できませんでした（HTTP ${response.status}）。`);
  }
  try {
    return hubDraftUpdateResponseSchema.parse(body);
  } catch {
    throw new Error("Hubから不正な下書き更新応答を受信しました。");
  }
}

export async function pollHubDeviceAuthorization(
  baseUrl: string,
  deviceToken: string,
  fetcher: typeof fetch = fetch,
): Promise<HubDevicePoll> {
  const response = await fetcher(
    `${normalizeHubBaseUrl(baseUrl)}/api/desktop/device/token`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${deviceToken}`,
      },
      redirect: "error",
    },
  );
  const body: unknown = await response.json().catch(() => null);
  if (![200, 202, 410].includes(response.status))
    throw new Error("Hubで端末認証を確認できませんでした。");
  try {
    return devicePollResponseSchema.parse(body);
  } catch {
    throw new Error("Hubから不正な端末認証応答を受信しました。");
  }
}

export async function revokeHubDeviceAuthorization(
  baseUrl: string,
  deviceToken: string,
  fetcher: typeof fetch = fetch,
) {
  const response = await fetcher(
    `${normalizeHubBaseUrl(baseUrl)}/api/desktop/device/token`,
    {
      method: "DELETE",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${deviceToken}`,
      },
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error("Hubの端末認証を解除できませんでした。");
  return true;
}
