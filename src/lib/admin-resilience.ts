export type AdminLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false };

export async function safelyLoadAdminData<T>(
  scope: string,
  load: () => Promise<T>,
): Promise<AdminLoadResult<T>> {
  try {
    return { ok: true, value: await load() };
  } catch (error) {
    console.error(
      `[admin/${scope}] provider failure`,
      error instanceof Error ? error.name : "unknown",
    );
    return { ok: false };
  }
}
