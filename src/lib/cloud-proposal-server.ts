import {
  createCloudProposalRunWithPersistence,
  getCloudProposalRunWithPersistence,
  listCloudProposalRunsWithPersistence,
  selectCloudProposalWithPersistence,
  type CloudProposalPersistence,
  type CloudStoryProposalRun,
  type CloudStoryProposalSelection,
} from "./cloud-proposal-persistence.ts";
import type { CloudStoryProposalResult } from "./cloud-proposal.ts";
import { DomainError } from "./domain-errors.ts";
import { createClient } from "./supabase/server.ts";

export type { CloudStoryProposalRun, CloudStoryProposalSelection };
type Client = Awaited<ReturnType<typeof createClient>>;
function adapter(supabase: Client): CloudProposalPersistence {
  const runFields = "id,owner_profile_id,research_report_id,content_class,status,result,engine_version,completed_at,created_at";
  const selectionFields = "id,owner_profile_id,research_report_id,content_class,proposal_run_id,candidate_id,candidate_snapshot,selected_at";
  return {
    async insertRun(value) {
      return await supabase.from("cloud_story_proposal_runs").insert(value).select("id").single<{ id: string }>();
    },
    async listRuns(profileId, reportId) {
      return await supabase.from("cloud_story_proposal_runs").select(runFields)
        .eq("owner_profile_id", profileId).eq("research_report_id", reportId)
        .order("created_at", { ascending: false }).limit(20).returns<CloudStoryProposalRun[]>();
    },
    async findRun(profileId, runId) {
      return await supabase.from("cloud_story_proposal_runs").select(runFields)
        .eq("owner_profile_id", profileId).eq("id", runId).maybeSingle<CloudStoryProposalRun>();
    },
    async findSelection(profileId, reportId) {
      return await supabase.from("cloud_story_proposal_selections").select(selectionFields)
        .eq("owner_profile_id", profileId).eq("research_report_id", reportId)
        .maybeSingle<CloudStoryProposalSelection>();
    },
    async insertSelection(value) {
      return await supabase.from("cloud_story_proposal_selections").insert(value).select("id").single<{ id: string }>();
    },
  };
}
export async function createCloudProposalRun(input: {
  profileId: string; reportId: string; contentClass?: "general" | "adult"; result: CloudStoryProposalResult;
}) {
  return createCloudProposalRunWithPersistence({ ...input, persistence: adapter(await createClient()) });
}
export async function listCloudProposalRuns(profileId: string, reportId: string) {
  return listCloudProposalRunsWithPersistence({ profileId, reportId, persistence: adapter(await createClient()) });
}
export async function getCloudProposalRun(profileId: string, runId: string) {
  return getCloudProposalRunWithPersistence({ profileId, runId, persistence: adapter(await createClient()) });
}
export async function getCloudProposalSelection(profileId: string, reportId: string) {
  const result = await adapter(await createClient()).findSelection(profileId, reportId);
  if (result.error) throw new DomainError("INTERNAL_ERROR", "企画の選択状況を取得できませんでした。", { cause: result.error });
  return result.data;
}
export async function selectCloudProposal(input: {
  profileId: string; run: CloudStoryProposalRun; candidateId: string;
}) {
  return selectCloudProposalWithPersistence({ ...input, persistence: adapter(await createClient()) });
}
