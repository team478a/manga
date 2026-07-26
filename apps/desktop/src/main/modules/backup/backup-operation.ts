export type BulkOperationOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: {
    phase: "validating" | "writing" | "extracting" | "committing";
    completed: number;
    total: number;
  }) => void;
};

export function assertBulkOperationActive(signal?: AbortSignal) {
  if (signal?.aborted) throw bulkOperationAbortError();
}

export function bulkOperationAbortError() {
  const error = new Error("処理をキャンセルしました。");
  error.name = "AbortError";
  return error;
}
