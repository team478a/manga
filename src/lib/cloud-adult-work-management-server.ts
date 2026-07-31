import { DomainError, ResourceNotFoundError } from "./domain-errors";
import {
  cloudAdultWorkManagementFeatureEnabled,
  type CloudAdultWorkStatus,
} from "./cloud-adult-work-management";
import { cloudCreatorContext } from "@/modules/cloud-creator/auth-context";
import type { CloudProjectSummary } from "@/modules/cloud-creator/contracts/types";

export type CloudAdultWorkRecord = {
  project_id: string;
  owner_profile_id: string;
  status: CloudAdultWorkStatus;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CloudAdultWorkSummary = CloudAdultWorkRecord & {
  project: CloudProjectSummary;
};

function assertEnabled() {
  if (!cloudAdultWorkManagementFeatureEnabled())
    throw new ResourceNotFoundError("成人向け作品管理は現在利用できません。");
}

export async function listCloudAdultWorks(): Promise<CloudAdultWorkSummary[]> {
  assertEnabled();
  const { supabase, profile } = await cloudCreatorContext();
  const { data: records, error: recordError } = await supabase
    .from("cloud_adult_work_records")
    .select("project_id,owner_profile_id,status,notes,created_at,updated_at")
    .eq("owner_profile_id", profile.id)
    .order("updated_at", { ascending: false });
  if (recordError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "成人向け作品一覧を読み込めませんでした。",
      { cause: recordError },
    );
  if (!records?.length) return [];

  const { data: projects, error: projectError } = await supabase
    .from("cloud_projects")
    .select(
      "id,title,description,content_class,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,updated_at",
    )
    .in(
      "id",
      records.map((record) => record.project_id),
    )
    .eq("content_class", "adult")
    .is("deleted_at", null);
  if (projectError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "成人向け作品一覧を読み込めませんでした。",
      { cause: projectError },
    );
  const byId = new Map(
    (projects ?? []).map((project) => [
      project.id,
      project as CloudProjectSummary,
    ]),
  );
  return records.flatMap((record) => {
    const project = byId.get(record.project_id);
    return project
      ? [
          {
            ...(record as CloudAdultWorkRecord),
            project,
          },
        ]
      : [];
  });
}

export async function getCloudAdultWork(
  projectId: string,
): Promise<CloudAdultWorkSummary> {
  assertEnabled();
  const parsedId = zUuid(projectId);
  const { supabase, profile } = await cloudCreatorContext();
  const [{ data: record, error: recordError }, { data: project, error: projectError }] =
    await Promise.all([
      supabase
        .from("cloud_adult_work_records")
        .select("project_id,owner_profile_id,status,notes,created_at,updated_at")
        .eq("project_id", parsedId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle(),
      supabase
        .from("cloud_projects")
        .select(
          "id,title,description,content_class,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,updated_at",
        )
        .eq("id", parsedId)
        .eq("content_class", "adult")
        .eq("visibility", "private")
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
  if (recordError || projectError)
    throw new DomainError(
      "INTERNAL_ERROR",
      "成人向け作品を読み込めませんでした。",
      { cause: recordError ?? projectError },
    );
  if (!record || !project)
    throw new ResourceNotFoundError("成人向け作品が見つかりません。");
  return {
    ...(record as CloudAdultWorkRecord),
    project: project as CloudProjectSummary,
  };
}

export async function updateCloudAdultWork(input: {
  projectId: string;
  title: string;
  description: string;
  status: CloudAdultWorkStatus;
  notes: string;
}) {
  assertEnabled();
  const { supabase } = await cloudCreatorContext();
  const { error } = await supabase.rpc("update_cloud_adult_work", {
    p_project_id: zUuid(input.projectId),
    p_title: input.title,
    p_description: input.description,
    p_status: input.status,
    p_notes: input.notes,
  });
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "成人向け作品を更新できませんでした。",
      { cause: error },
    );
}

function zUuid(value: string) {
  const match = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!match.test(value))
    throw new ResourceNotFoundError("成人向け作品が見つかりません。");
  return value;
}
