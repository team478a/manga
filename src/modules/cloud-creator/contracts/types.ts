import type { CloudGenerationInput } from "@mangai/ai-core";

export type CloudProjectSummary = {
  id: string;
  title: string;
  description: string;
  age_rating: "全年齢" | "12歳以上" | "15歳以上";
  reading_direction: "rtl" | "ltr";
  width: number;
  height: number;
  dpi: number;
  visibility: "private" | "unlisted" | "public";
  revision: number;
  storage_bytes: number;
  source_surface: "cloud" | "desktop";
  cover_page_id: string | null;
  updated_at: string;
};

export type CloudEpisode = {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  revision: number;
};

export type CloudPage = {
  id: string;
  project_id: string;
  episode_id: string;
  page_number: number;
  order_index: number;
  width: number;
  height: number;
  background_color: string;
  revision: number;
};

export type CloudGenerationJob = {
  id: string;
  project_id: string;
  page_id: string | null;
  kind: "image" | "text";
  job_type: CloudGenerationInput["jobType"];
  provider_id: string;
  model_id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  progress: number;
  attempt_count: number;
  max_attempts: number;
  estimated_cost_micros: number | null;
  actual_cost_micros: number | null;
  output: Record<string, unknown> | null;
  output_asset_id: string | null;
  target_panel_id: string | null;
  source_asset_id: string | null;
  outpainting_direction: "left" | "right" | "top" | "bottom" | "all" | null;
  revision_preset: "face" | "hands" | "expression" | "costume" | "background" | "polish" | null;
  generation_operation:
    | "text_to_image"
    | "image_to_image"
    | "inpainting"
    | "outpainting"
    | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CloudAiQuota = {
  plan_key: "free" | "trial" | "creator";
  entitlement_status:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "expired";
  period_starts_at: string;
  period_ends_at: string;
  credits_limit: number;
  credits_reserved: number;
  credits_used: number;
  cost_limit_micros: number;
  cost_reserved_micros: number;
  cost_actual_micros: number;
  currency: string;
  generation_enabled: boolean;
};

export type CloudAsset = {
  id: string;
  project_id: string;
  file_name: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  url: string;
};
