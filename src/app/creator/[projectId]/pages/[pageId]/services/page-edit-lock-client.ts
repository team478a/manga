export type PageEditLeaseState = "acquired" | "locked" | "unavailable";

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
