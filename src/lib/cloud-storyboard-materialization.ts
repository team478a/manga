import { z } from "zod";
import { DomainError, ResourceNotFoundError } from "./domain-errors.ts";

export const cloudStoryboardCanvasFeatureEnabled = () =>
  process.env.CLOUD_STORYBOARD_CANVAS_ENABLED?.toLowerCase() === "true";

export type CloudStoryboardMaterialization = {
  id: string;
  owner_profile_id: string;
  storyboard_version_id: string;
  project_id: string;
  first_page_id: string;
  created_at: string;
};

type Result<T> = { data: T | null; error: unknown };
export type CloudStoryboardMaterializationPersistence = {
  find(
    profileId: string,
    storyboardVersionId: string,
  ): Promise<Result<CloudStoryboardMaterialization>>;
  materialize(
    storyboardVersionId: string,
  ): Promise<Result<Array<{ project_id: string; first_page_id: string; was_created: boolean }>>>;
};

const uuid = z.string().uuid();
const internal = (message: string, cause: unknown) =>
  new DomainError("INTERNAL_ERROR", message, { cause });

export async function getCloudStoryboardMaterializationWithPersistence(input: {
  profileId: string;
  storyboardVersionId: string;
  persistence: CloudStoryboardMaterializationPersistence;
}) {
  if (!uuid.safeParse(input.storyboardVersionId).success)
    throw new ResourceNotFoundError("Canvas変換が見つかりません。");
  const result = await input.persistence.find(input.profileId, input.storyboardVersionId);
  if (result.error)
    throw internal("Canvas変換状況を取得できませんでした。", result.error);
  return result.data;
}

export async function materializeCloudStoryboardWithPersistence(input: {
  storyboardVersionId: string;
  persistence: CloudStoryboardMaterializationPersistence;
}) {
  if (!uuid.safeParse(input.storyboardVersionId).success)
    throw new ResourceNotFoundError("採用ネームが見つかりません。");
  const result = await input.persistence.materialize(input.storyboardVersionId);
  const row = result.data?.[0];
  if (result.error || !row?.project_id || !row.first_page_id)
    throw internal("Canvas下書きを作成できませんでした。", result.error);
  return row;
}
