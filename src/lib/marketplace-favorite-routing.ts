import { resolvePostAuthRedirect } from "./auth-redirect.ts";

export function resolveMarketplaceFavoriteReturnPath(
  value: string | null | undefined,
  fallbackWorkId: string,
) {
  const fallback = `/works/${fallbackWorkId}`;
  const candidate = resolvePostAuthRedirect(value);
  if (
    candidate === "/" ||
    candidate === "/works" ||
    candidate.startsWith("/works?") ||
    candidate === "/dashboard/favorites" ||
    /^\/works\/[0-9a-f-]+(?:\?.*)?$/i.test(candidate)
  ) {
    return candidate;
  }
  return fallback;
}

export function marketplaceFavoriteFeedbackPath(
  returnPath: string,
  kind: "favorite_error" | "favorite_message",
  message: string,
) {
  const target = new URL(returnPath, "https://mangai.invalid");
  target.searchParams.set(kind, message);
  return `${target.pathname}${target.search}${target.hash}`;
}
