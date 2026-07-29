import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";
import type {
  CloudResearchEvidence,
  CloudResearchInput,
  CloudResearchResult,
} from "@/lib/cloud-research";
import { createClient } from "@/lib/supabase/server";

export type CloudResearchReport = {
  id: string;
  owner_profile_id: string;
  status: "completed";
  input: CloudResearchInput;
  sources: CloudResearchEvidence[];
  result: CloudResearchResult;
  engine_version: string;
  completed_at: string;
  created_at: string;
};

export async function createCloudResearchReport({
  profileId,
  input,
  result,
}: {
  profileId: string;
  input: CloudResearchInput;
  result: CloudResearchResult;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_market_research_reports")
    .insert({
      owner_profile_id: profileId,
      status: "completed",
      input,
      sources: input.evidence,
      result,
      engine_version: result.engineVersion,
      completed_at: result.generatedAt,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析レポートを保存できませんでした。",
      { cause: error },
    );
  return data.id;
}

export async function listCloudResearchReports(profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_market_research_reports")
    .select(
      "id,owner_profile_id,status,input,sources,result,engine_version,completed_at,created_at",
    )
    .eq("owner_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<CloudResearchReport[]>();
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析履歴を取得できませんでした。",
      { cause: error },
    );
  return data ?? [];
}

export async function getCloudResearchReport(
  profileId: string,
  reportId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_market_research_reports")
    .select(
      "id,owner_profile_id,status,input,sources,result,engine_version,completed_at,created_at",
    )
    .eq("id", reportId)
    .eq("owner_profile_id", profileId)
    .maybeSingle<CloudResearchReport>();
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "市場分析レポートを取得できませんでした。",
      { cause: error },
    );
  if (!data) throw new ResourceNotFoundError("市場分析レポートが見つかりません。");
  return data;
}

