import { z } from "zod";
import { DomainError, ProviderUnavailableError } from "./domain-errors.ts";
import { createAdminClient } from "./supabase/admin.ts";

const runtimeConfigSchema = z.object({
  enabled: z.boolean(),
  api_key: z.string().min(20).max(500),
  from_email: z.string().email().max(254),
  from_name: z.string().min(1).max(80),
});

export type CloudGeneralMonitorEmailSettings = {
  enabled: boolean;
  configured: boolean;
  fromEmail: string;
  fromName: string;
  updatedAt: string;
};

export async function getCloudGeneralMonitorEmailSettings(): Promise<
  CloudGeneralMonitorEmailSettings | null
> {
  const { data, error } = await createAdminClient()
    .from("cloud_general_monitor_email_settings")
    .select("enabled,secret_id,from_email,from_name,updated_at")
    .eq("singleton", true)
    .maybeSingle<{
      enabled: boolean;
      secret_id: string | null;
      from_email: string;
      from_name: string;
      updated_at: string;
    }>();
  if (error || !data) return null;
  return {
    enabled: data.enabled,
    configured: Boolean(data.secret_id),
    fromEmail: data.from_email,
    fromName: data.from_name,
    updatedAt: data.updated_at,
  };
}

export async function setCloudGeneralMonitorEmailSettings(input: {
  actorProfileId: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
}) {
  const { error } = await createAdminClient().rpc(
    "set_cloud_general_monitor_email_provider",
    {
      p_actor_profile_id: input.actorProfileId,
      p_api_key: input.apiKey,
      p_from_email: input.fromEmail,
      p_from_name: input.fromName,
      p_enabled: true,
    },
  );
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "招待メール設定を保存できませんでした。",
      { cause: error },
    );
}

export async function getCloudGeneralMonitorEmailRuntimeConfig() {
  const { data, error } = await createAdminClient().rpc(
    "get_cloud_general_monitor_email_runtime_config",
  );
  const row = Array.isArray(data) ? data[0] : data;
  const parsed = runtimeConfigSchema.safeParse(row);
  if (error || !parsed.success || !parsed.data.enabled)
    throw new ProviderUnavailableError(
      "招待メール設定が未完了です。管理者画面で設定してください。",
    );
  return {
    apiKey: parsed.data.api_key,
    fromEmail: parsed.data.from_email,
    fromName: parsed.data.from_name,
  };
}
