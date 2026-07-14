import { z } from "zod";

const hubStatusResponseSchema = z.discriminatedUnion("linked", [
  z.object({
    linked: z.literal(true),
    projectId: z.string().uuid(),
    work: z.object({
      id: z.string().uuid(),
      title: z.string(),
      updatedAt: z.string(),
      path: z.string().startsWith("/"),
    }),
    sales: z.object({
      activeProductCount: z.number().int().nonnegative(),
      available: z.boolean(),
    }),
  }),
  z.object({
    linked: z.literal(false),
    message: z.string(),
  }),
]);

export type HubStatus = z.infer<typeof hubStatusResponseSchema>;

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
): Promise<HubStatus> {
  const normalizedBaseUrl = normalizeHubBaseUrl(baseUrl);
  const endpoint = `${normalizedBaseUrl}/api/desktop/projects/${encodeURIComponent(projectId)}/status`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(endpoint, {
      method: "GET",
      headers: { accept: "application/json" },
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
