import { z } from "zod";
import { DomainError, ProviderUnavailableError } from "./domain-errors.ts";
import { createAdminClient } from "./supabase/admin.ts";

export const cloudGeneralImageModelSchema = z.enum([
  "flux-2-klein-9b",
  "flux-2-pro",
  "flux-2-max",
]);
export type CloudGeneralImageModel = z.infer<
  typeof cloudGeneralImageModelSchema
>;

const pricingVersions: Record<CloudGeneralImageModel, string> = {
  "flux-2-klein-9b": "bfl-flux2-2026-03",
  "flux-2-pro": "bfl-flux2-pro-2026-08",
  "flux-2-max": "bfl-flux2-2026-03",
};

export type CloudGeneralImageSettings = {
  enabled: boolean;
  model: CloudGeneralImageModel;
  configured: boolean;
  updatedAt: string;
};

export function cloudGeneralImagePricingVersion(
  model: CloudGeneralImageModel,
) {
  return pricingVersions[model];
}

export async function getCloudGeneralImageSettings(): Promise<
  CloudGeneralImageSettings | null
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cloud_general_image_provider_settings")
    .select("enabled,model,secret_id,updated_at")
    .eq("singleton", true)
    .maybeSingle<{
      enabled: boolean;
      model: string;
      secret_id: string | null;
      updated_at: string;
    }>();
  if (error || !data) return null;
  const model = cloudGeneralImageModelSchema.safeParse(data.model);
  if (!model.success) return null;
  return {
    enabled: data.enabled,
    model: model.data,
    configured: Boolean(data.secret_id),
    updatedAt: data.updated_at,
  };
}

export async function setCloudGeneralImageSettings(input: {
  actorProfileId: string;
  apiKey: string;
  model: CloudGeneralImageModel;
  enabled: boolean;
}) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_cloud_general_image_provider", {
    p_actor_profile_id: input.actorProfileId,
    p_api_key: input.apiKey,
    p_model: input.model,
    p_enabled: input.enabled,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "一般向け画像生成AI設定を保存できませんでした。",
      { cause: error },
    );
}

export async function getCloudGeneralImageRuntimeConfig() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "get_cloud_general_image_runtime_config",
  );
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = z
    .object({
      enabled: z.boolean(),
      model: cloudGeneralImageModelSchema,
      api_key: z.string().min(20).max(500),
    })
    .safeParse(row);
  if (error || !parsed.success || !parsed.data.enabled)
    throw new ProviderUnavailableError(
      "一般向け画像生成AIは現在準備中です。管理者へお問い合わせください。",
    );
  return {
    apiKey: parsed.data.api_key,
    model: parsed.data.model,
    pricingVersion: cloudGeneralImagePricingVersion(parsed.data.model),
  };
}
