export type ClaimedCloudGenerationJob = {
  id: string;
  project_id: string;
  page_id: string | null;
  created_by_profile_id: string;
  kind: "image" | "text";
  provider_id: string;
  model_id: string;
  idempotency_key: string;
  input: unknown;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
};

export type UploadedCloudGeneratedAsset = {
  assetId: string;
  storagePath: string;
  fileName: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
};
