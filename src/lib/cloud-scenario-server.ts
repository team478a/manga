import {
  confirmCloudScenarioWithPersistence,
  createCloudScenarioRunWithPersistence,
  getCloudScenarioRunWithPersistence,
  listCloudScenarioRunsWithPersistence,
  type CloudScenarioConfirmation,
  type CloudScenarioPersistence,
  type CloudScenarioRun,
} from "@/lib/cloud-scenario-persistence";
import type { CloudScenarioResult } from "@/lib/cloud-scenario";
import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export type { CloudScenarioConfirmation, CloudScenarioRun };

type Client = Awaited<ReturnType<typeof createClient>>;

function adapter(supabase: Client): CloudScenarioPersistence {
  const runFields =
    "id,owner_profile_id,proposal_selection_id,research_report_id,parent_run_id,revision_number,status,result,engine_version,completed_at,created_at";
  const confirmationFields =
    "id,owner_profile_id,proposal_selection_id,scenario_run_id,scenario_snapshot,confirmed_at";
  return {
    async createRun(input) {
      const response = await supabase.rpc("create_cloud_scenario_run", {
        p_proposal_selection_id: input.proposalSelectionId,
        p_parent_run_id: input.parentRunId,
        p_result: input.result,
        p_completed_at: input.completedAt,
      });
      return { data: response.data as string | null, error: response.error };
    },
    async listRuns(profileId, proposalSelectionId) {
      let query = supabase
        .from("cloud_scenario_runs")
        .select(runFields)
        .eq("owner_profile_id", profileId);
      if (proposalSelectionId)
        query = query.eq("proposal_selection_id", proposalSelectionId);
      return await query
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<CloudScenarioRun[]>();
    },
    async findRun(profileId, runId) {
      return await supabase
        .from("cloud_scenario_runs")
        .select(runFields)
        .eq("owner_profile_id", profileId)
        .eq("id", runId)
        .maybeSingle<CloudScenarioRun>();
    },
    async findConfirmation(profileId, proposalSelectionId) {
      return await supabase
        .from("cloud_scenario_confirmations")
        .select(confirmationFields)
        .eq("owner_profile_id", profileId)
        .eq("proposal_selection_id", proposalSelectionId)
        .maybeSingle<CloudScenarioConfirmation>();
    },
    async insertConfirmation(confirmation) {
      return await supabase
        .from("cloud_scenario_confirmations")
        .insert(confirmation)
        .select("id")
        .single<{ id: string }>();
    },
  };
}

export async function createCloudScenarioRun(input: {
  proposalSelectionId: string;
  parentRunId?: string | null;
  result: CloudScenarioResult;
}) {
  return createCloudScenarioRunWithPersistence({
    ...input,
    persistence: adapter(await createClient()),
  });
}

export async function listCloudScenarioRuns(
  profileId: string,
  proposalSelectionId?: string,
) {
  return listCloudScenarioRunsWithPersistence({
    profileId,
    proposalSelectionId,
    persistence: adapter(await createClient()),
  });
}

export async function getCloudScenarioRun(profileId: string, runId: string) {
  return getCloudScenarioRunWithPersistence({
    profileId,
    runId,
    persistence: adapter(await createClient()),
  });
}

export async function getCloudScenarioConfirmation(
  profileId: string,
  proposalSelectionId: string,
) {
  const persistence = adapter(await createClient());
  const result = await persistence.findConfirmation(
    profileId,
    proposalSelectionId,
  );
  if (result.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "シナリオの確定状況を取得できませんでした。",
      { cause: result.error },
    );
  return result.data;
}

export async function getCloudScenarioConfirmationById(
  profileId: string,
  confirmationId: string,
) {
  if (!z.string().uuid().safeParse(confirmationId).success)
    throw new ResourceNotFoundError(
      "確定シナリオが見つかりません。",
    );
  const supabase = await createClient();
  const result = await supabase
    .from("cloud_scenario_confirmations")
    .select(
      "id,owner_profile_id,proposal_selection_id,scenario_run_id,scenario_snapshot,confirmed_at",
    )
    .eq("owner_profile_id", profileId)
    .eq("id", confirmationId)
    .maybeSingle<CloudScenarioConfirmation>();
  if (result.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "確定シナリオを取得できませんでした。",
      { cause: result.error },
    );
  if (!result.data)
    throw new ResourceNotFoundError(
      "確定シナリオが見つかりません。",
    );
  return result.data;
}

export async function confirmCloudScenario(input: {
  profileId: string;
  run: CloudScenarioRun;
}) {
  return confirmCloudScenarioWithPersistence({
    ...input,
    persistence: adapter(await createClient()),
  });
}
