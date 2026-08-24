type SupabaseFunctionError = {
  code?: unknown;
  message?: unknown;
};

export function isNonRecordableDisplayedEventError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as SupabaseFunctionError;
  return (
    candidate.code === "P0001" &&
    typeof candidate.message === "string" &&
    candidate.message.includes("cloud_generation_job_not_found")
  );
}
