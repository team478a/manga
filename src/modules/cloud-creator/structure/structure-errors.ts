import {
  DomainError,
  PermissionDeniedError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

type StructureDatabaseError = {
  message?: string;
};

type StructureOperation = "add" | "rename" | "move" | "delete";

const operationFallbacks: Record<StructureOperation, string> = {
  add: "Episode／Pageを追加できませんでした。",
  rename: "Episode名を更新できませんでした。",
  move: "Episode／Pageを移動できませんでした。",
  delete: "Episode／Pageを削除できませんでした。",
};

export function mapCloudStructureError(
  error: StructureDatabaseError | null | undefined,
  operation: StructureOperation,
) {
  const signal = error?.message?.split(":", 1)[0];
  switch (signal) {
    case "cloud_project_not_editable":
    case "cloud_episode_not_editable":
    case "cloud_page_not_editable":
      return new PermissionDeniedError(
        "このEpisode／Pageを編集する権限がありません。",
      );
    case "last_episode_cannot_be_deleted":
      return new ValidationError("最後のEpisodeは削除できません。");
    case "last_page_cannot_be_deleted":
      return new ValidationError("最後のPageは削除できません。");
    case "invalid_move_direction":
      return new ValidationError("移動方向が不正です。");
    default:
      return new DomainError("INTERNAL_ERROR", operationFallbacks[operation], {
        cause: error,
      });
  }
}
