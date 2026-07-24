export async function persistWithCompensation<T extends { error: unknown }>({
  persist,
  compensate,
}: {
  persist: () => PromiseLike<T>;
  compensate: () => Promise<void>;
}) {
  let result: T;
  try {
    result = await persist();
  } catch (error) {
    await compensate();
    throw error;
  }
  if (result.error) await compensate();
  return result;
}
