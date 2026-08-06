import type { Profile } from "@/lib/types";

export function profileAccessRedirect(hasUser: boolean, profile: Profile | null) {
  if (!hasUser) return "/login";
  if (!profile) return "/signup?message=profile";
  return null;
}

export function adminAccessRedirect(profile: Pick<Profile, "role">) {
  return profile.role === "admin" ? null : "/dashboard";
}

export function profileOwnsResource(
  authenticatedProfileId: string,
  resourceProfileId: string,
) {
  return authenticatedProfileId === resourceProfileId;
}

