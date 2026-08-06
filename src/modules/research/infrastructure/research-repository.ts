import type {
  CloudResearchInput,
  CloudResearchResult,
} from "../domain/research-report.ts";
import {
  createCloudResearchReportWithPersistence,
  getCloudResearchReportWithPersistence,
  listCloudResearchReportsWithPersistence,
  type CloudResearchPersistence,
  type CloudResearchReport,
} from "../application/list-reports.ts";
import { createClient } from "../../../lib/supabase/server.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";

export type { CloudResearchReport };

type CloudResearchSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function createCloudResearchPersistence(
  supabase: CloudResearchSupabaseClient,
): CloudResearchPersistence {
  return {
    async insert(report) {
      return await supabase
        .from("cloud_market_research_reports")
        .insert(report)
        .select("id")
        .single<{ id: string }>();
    },
    async list(profileId) {
      return await supabase
        .from("cloud_market_research_reports")
        .select(
          "id,owner_profile_id,status,input,sources,result,engine_version,completed_at,created_at",
        )
        .eq("owner_profile_id", profileId)
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<CloudResearchReport[]>();
    },
    async find(profileId, reportId) {
      return await supabase
        .from("cloud_market_research_reports")
        .select(
          "id,owner_profile_id,status,input,sources,result,engine_version,completed_at,created_at",
        )
        .eq("id", reportId)
        .eq("owner_profile_id", profileId)
        .maybeSingle<CloudResearchReport>();
    },
  };
}

export async function createCloudResearchReport({
  profileId,
  input,
  result,
}: {
  profileId: string;
  input: CloudResearchInput;
  result: CloudResearchResult;
}) {
  // The caller has already authenticated the profile and verified the active
  // monitor enrollment. Persist through the trusted server client so a stale
  // browser RLS context cannot discard a completed, quota-counted analysis.
  const supabase = createAdminClient();
  return createCloudResearchReportWithPersistence({
    profileId,
    input,
    result,
    persistence: createCloudResearchPersistence(supabase),
  });
}

export async function listCloudResearchReports(profileId: string) {
  const supabase = await createClient();
  return listCloudResearchReportsWithPersistence({
    profileId,
    persistence: createCloudResearchPersistence(supabase),
  });
}

export async function getCloudResearchReport(
  profileId: string,
  reportId: string,
) {
  const supabase = await createClient();
  return getCloudResearchReportWithPersistence({
    profileId,
    reportId,
    persistence: createCloudResearchPersistence(supabase),
  });
}
