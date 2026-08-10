export type PageEditLeaseState = "acquired" | "locked" | "unavailable";

type PageEditLockStorage = Pick<Storage, "getItem" | "setItem">;

const storageKeyFor = (pageId: string) =>
  `mangai:cloud-page-edit-lock:${pageId}`;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getOrCreatePageEditLockToken(
  pageId: string,
  storage?: PageEditLockStorage,
  createToken: () => string = () => crypto.randomUUID(),
) {
  try {
    const availableStorage =
      storage ??
      (typeof window === "undefined" ? undefined : window.sessionStorage);
    if (!availableStorage) return createToken();

    const storageKey = storageKeyFor(pageId);
    const existingToken = availableStorage.getItem(storageKey);
    if (existingToken && uuidPattern.test(existingToken)) return existingToken;

    const token = createToken();
    availableStorage.setItem(storageKey, token);
    return token;
  } catch {
    return createToken();
  }
}

const endpointFor = (pageId: string) =>
  `/api/creator/page-locks/${encodeURIComponent(pageId)}`;

export async function acquirePageEditLease(
  pageId: string,
  lockToken: string,
): Promise<PageEditLeaseState> {
  try {
    const response = await fetch(endpointFor(pageId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lockToken }),
    });
    if (response.status === 409) return "locked";
    if (!response.ok) return "unavailable";
    const body = (await response.json()) as { available?: boolean };
    return body.available ? "acquired" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function releasePageEditLease(pageId: string, lockToken: string) {
  return fetch(endpointFor(pageId), {
    method: "DELETE",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lockToken }),
  }).catch(() => undefined);
}
