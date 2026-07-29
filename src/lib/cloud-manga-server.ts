import {
  createCloudMangaGenerationWithPersistence,
  getCloudMangaGenerationByConfirmationWithPersistence,
  getCloudMangaGenerationWithPersistence,
  listCloudMangaGenerationsWithPersistence,
  type CloudMangaGeneration,
  type CloudMangaPersistence,
} from "@/lib/cloud-manga-persistence";
import type { CloudMangaPlanResult } from "@/lib/cloud-manga";
import { createClient } from "@/lib/supabase/server";

export type { CloudMangaGeneration };

type Client = Awaited<ReturnType<typeof createClient>>;

function adapter(supabase: Client): CloudMangaPersistence {
  const fields =
    "id,owner_profile_id,scenario_confirmation_id,scenario_run_id,project_id,status,result,engine_version,completed_at,created_at";
  return {
    async createGeneration(input) {
      const response = await supabase.rpc("create_cloud_manga_generation", {
        p_scenario_confirmation_id: input.confirmationId,
        p_result: input.result,
        p_completed_at: input.completedAt,
      });
      return {
        data: response.data?.[0] ?? null,
        error: response.error,
      };
    },
    async listGenerations(profileId) {
      return await supabase
        .from("cloud_manga_generations")
        .select(fields)
        .eq("owner_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<CloudMangaGeneration[]>();
    },
    async findGeneration(profileId, generationId) {
      return await supabase
        .from("cloud_manga_generations")
        .select(fields)
        .eq("owner_profile_id", profileId)
        .eq("id", generationId)
        .maybeSingle<CloudMangaGeneration>();
    },
    async findByConfirmation(profileId, confirmationId) {
      return await supabase
        .from("cloud_manga_generations")
        .select(fields)
        .eq("owner_profile_id", profileId)
        .eq("scenario_confirmation_id", confirmationId)
        .maybeSingle<CloudMangaGeneration>();
    },
  };
}

export async function createCloudMangaGeneration(input: {
  confirmationId: string;
  result: CloudMangaPlanResult;
}) {
  return createCloudMangaGenerationWithPersistence({
    ...input,
    persistence: adapter(await createClient()),
  });
}

export async function listCloudMangaGenerations(profileId: string) {
  return listCloudMangaGenerationsWithPersistence({
    profileId,
    persistence: adapter(await createClient()),
  });
}

export async function getCloudMangaGeneration(
  profileId: string,
  generationId: string,
) {
  return getCloudMangaGenerationWithPersistence({
    profileId,
    generationId,
    persistence: adapter(await createClient()),
  });
}

export async function getCloudMangaGenerationByConfirmation(
  profileId: string,
  confirmationId: string,
) {
  return getCloudMangaGenerationByConfirmationWithPersistence({
    profileId,
    confirmationId,
    persistence: adapter(await createClient()),
  });
}
