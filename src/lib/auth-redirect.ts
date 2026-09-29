const fallbackPath = "/dashboard";
const internalOrigin = "https://mangai.invalid";

export function resolvePostAuthRedirect(value: string | null | undefined) {
  const candidate = value?.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallbackPath;
  }

  try {
    const parsed = new URL(candidate, internalOrigin);
    if (parsed.origin !== internalOrigin) return fallbackPath;
    if (parsed.pathname === "/login" || parsed.pathname.startsWith("/auth/")) {
      return fallbackPath;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallbackPath;
  }
}
