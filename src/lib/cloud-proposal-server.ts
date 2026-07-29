import {
  createCloudProposalRunWithPersistence,
  getCloudProposalRunWithPersistence,
  listCloudProposalRunsWithPersistence,
  selectCloudProposalWithPersistence,
  type CloudProposalPersistence,
  type CloudStoryProposalRun,
  type CloudStoryProposalSelection,
} from "@/lib/cloud-proposal-persistence";
import type { CloudStoryProposalResult } from "@/lib/cloud-proposal";
import { DomainError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";

export type { CloudStoryProposalRun, CloudStoryProposalSelection };

type Client = Awaited<ReturnType<typeof createClient>>;

function adapter(supabase: Client): CloudProposalPersistence {
  const runFields =
    "id,owner_profile_id,research_report_id,status,result,engine_version,completed_at,created_at";
  const selectionFields =
    "id,owner_profile_id,research_report_id,proposal_run_id,candidate_id,candidate_snapshot,selected_at";
  return {
    async insertRun(run) {
      return await supabase
        .from("cloud_story_proposal_runs")
        .insert(run)
        .select("id")
        .single<{ id: string }>();
    },
    async listRuns(profileId) {
      return await supabase
        .from("cloud_story_proposal_runs")
        .select(runFields)
        .eq("owner_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<CloudStoryProposalRun[]>();
    },
    async findRun(profileId, runId) {
      return await supabase
        .from("cloud_story_proposal_runs")
        .select(runFields)
        .eq("owner_profile_id", profileId)
        .eq("id", runId)
        .maybeSingle<CloudStoryProposalRun>();
    },
    async findSelection(profileId, reportId) {
      return await supabase
        .from("cloud_story_proposal_selections")
        .select(selectionFields)
        .eq("owner_profile_id", profileId)
        .eq("research_report_id", reportId)
        .maybeSingle<CloudStoryProposalSelection>();
    },
    async insertSelection(selection) {
      return await supabase
        .from("cloud_story_proposal_selections")
        .insert(selection)
        .select("id")
        .single<{ id: string }>();
    },
  };
}

export async function createCloudProposalRun(input: {
  profileId: string;
  reportId: string;
  result: CloudStoryProposalResult;
}) {
  const supabase = await createClient();
  return createCloudProposalRunWithPersistence({
    ...input,
    persistence: adapter(supabase),
  });
}

export async function listCloudProposalRuns(profileId: string) {
  const supabase = await createClient();
  return listCloudProposalRunsWithPersistence({
    profileId,
    persistence: adapter(supabase),
  });
}

export async function getCloudProposalRun(profileId: string, runId: string) {
  const supabase = await createClient();
  return getCloudProposalRunWithPersistence({
    profileId,
    runId,
    persistence: adapter(supabase),
  });
}

export async function getCloudProposalSelection(
  profileId: string,
  reportId: string,
) {
  const persistence = adapter(await createClient());
  const result = await persistence.findSelection(profileId, reportId);
  if (result.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "企画の採用状況を取得できませんでした。",
      { cause: result.error },
    );
  return result.data;
}

export async function selectCloudProposal(input: {
  profileId: string;
  run: CloudStoryProposalRun;
  candidateId: string;
}) {
  const supabase = await createClient();
  return selectCloudProposalWithPersistence({
    ...input,
    persistence: adapter(supabase),
  });
}
