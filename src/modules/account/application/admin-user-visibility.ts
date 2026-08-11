export type AdminUserProfileReference = {
  user_id: string;
};

export type AdminAuthUserReference = {
  id: string;
  deleted_at?: string | null;
};

export function filterVisibleAdminUserProfiles<
  TProfile extends AdminUserProfileReference,
>(
  profiles: TProfile[],
  authUsers: AdminAuthUserReference[] | null,
): TProfile[] {
  if (authUsers === null) return profiles;

  const visibleAuthUserIds = new Set(
    authUsers.filter((user) => !user.deleted_at).map((user) => user.id),
  );
  return profiles.filter((profile) =>
    visibleAuthUserIds.has(profile.user_id),
  );
}

export function countVisibleAdminUserProfiles(
  profiles: AdminUserProfileReference[],
  authUsers: AdminAuthUserReference[] | null,
): number {
  return filterVisibleAdminUserProfiles(profiles, authUsers).length;
}
