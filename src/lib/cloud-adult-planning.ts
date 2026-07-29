import { z } from "zod";
import { getCloudAdultResearchAccess } from "@/lib/cloud-adult-research";
import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";
import { createClient } from "@/lib/supabase/server";
import {
  CLOUD_ADULT_PLANNING_FEATURE_KEY,
  cloudAdultPlanningFeatureEnabled,
  evaluateCloudAdultPlanningAccess,
  type CloudAdultFeatureGrant,
  type CloudAdultPlanningAccess,
  type CloudAdultPlanningInput,
} from "./cloud-adult-planning-policy.ts";

export * from "./cloud-adult-planning-policy.ts";

export type CloudAdultPlanningBrief = CloudAdultPlanningInput & {
  id: string;
  ownerProfileId: string;
  researchReportId: string;
  contentClass: "adult";
  createdAt: string;
  updatedAt: string;
};

type PlanningBriefRow = {
  id: string;
  owner_profile_id: string;
  research_report_id: string;
  content_class: "adult";
  status: "draft" | "ready";
  working_title: string;
  concept: string;
  protagonist: string;
  protagonist_goal: string;
  central_conflict: string;
  reader_promise: string;
  tone: string;
  differentiation: string;
  ending_direction: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

function toBrief(row: PlanningBriefRow): CloudAdultPlanningBrief {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    researchReportId: row.research_report_id,
    contentClass: row.content_class,
    status: row.status,
    workingTitle: row.working_title,
    concept: row.concept,
    protagonist: row.protagonist,
    protagonistGoal: row.protagonist_goal,
    centralConflict: row.central_conflict,
    readerPromise: row.reader_promise,
    tone: row.tone,
    differentiation: row.differentiation,
    endingDirection: row.ending_direction,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCloudAdultPlanningAccess(
  profileId: string,
): Promise<CloudAdultPlanningAccess> {
  if (!cloudAdultPlanningFeatureEnabled())
    return evaluateCloudAdultPlanningAccess({
      featureEnabled: false,
      adultAccessAllowed: false,
      grant: null,
    });
  const adultAccess = await getCloudAdultResearchAccess(profileId);
  if (!adultAccess.allowed)
    return evaluateCloudAdultPlanningAccess({
      featureEnabled: true,
      adultAccessAllowed: false,
      grant: null,
    });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_adult_feature_grants")
    .select("profile_id,feature_key,status,source,granted_at,valid_until")
    .eq("profile_id", profileId)
    .eq("feature_key", CLOUD_ADULT_PLANNING_FEATURE_KEY)
    .maybeSingle<CloudAdultFeatureGrant>();
  if (error)
    return {
      allowed: false,
      reason: "configuration_unavailable",
      grant: null,
    };
  return evaluateCloudAdultPlanningAccess({
    featureEnabled: true,
    adultAccessAllowed: true,
    grant: data,
  });
}

export async function createCloudAdultPlanningBrief({
  profileId,
  researchReportId,
  input,
}: {
  profileId: string;
  researchReportId: string;
  input: CloudAdultPlanningInput;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_adult_planning_briefs")
    .insert({
      owner_profile_id: profileId,
      research_report_id: researchReportId,
      content_class: "adult",
      status: input.status,
      working_title: input.workingTitle,
      concept: input.concept,
      protagonist: input.protagonist,
      protagonist_goal: input.protagonistGoal,
      central_conflict: input.centralConflict,
      reader_promise: input.readerPromise,
      tone: input.tone,
      differentiation: input.differentiation,
      ending_direction: input.endingDirection,
      notes: input.notes,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data)
    throw new DomainError(
      "INTERNAL_ERROR",
      "企画ブリーフを保存できませんでした。",
      { cause: error },
    );
  return data.id;
}

export async function listCloudAdultPlanningBriefs(
  profileId: string,
  researchReportId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_adult_planning_briefs")
    .select("*")
    .eq("owner_profile_id", profileId)
    .eq("research_report_id", researchReportId)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<PlanningBriefRow[]>();
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "企画ブリーフ履歴を取得できませんでした。",
      { cause: error },
    );
  return (data ?? []).map(toBrief);
}

export async function getCloudAdultPlanningBrief(
  profileId: string,
  researchReportId: string,
  briefId: string,
) {
  if (!z.string().uuid().safeParse(briefId).success)
    throw new ResourceNotFoundError("企画ブリーフが見つかりません。");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cloud_adult_planning_briefs")
    .select("*")
    .eq("id", briefId)
    .eq("owner_profile_id", profileId)
    .eq("research_report_id", researchReportId)
    .maybeSingle<PlanningBriefRow>();
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "企画ブリーフを取得できませんでした。",
      { cause: error },
    );
  if (!data)
    throw new ResourceNotFoundError("企画ブリーフが見つかりません。");
  return toBrief(data);
}
