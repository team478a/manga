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
  add: "話／ページを追加できませんでした。",
  rename: "話の名前を更新できませんでした。",
  move: "話／ページを移動できませんでした。",
  delete: "話／ページを削除できませんでした。",
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
        "この話／ページを編集する権限がありません。",
      );
    case "last_episode_cannot_be_deleted":
      return new ValidationError("最後の話は削除できません。");
    case "last_page_cannot_be_deleted":
      return new ValidationError("最後のページは削除できません。");
    case "invalid_move_direction":
      return new ValidationError("移動方向が不正です。");
    default:
      return new DomainError("INTERNAL_ERROR", operationFallbacks[operation], {
        cause: error,
      });
  }
}
