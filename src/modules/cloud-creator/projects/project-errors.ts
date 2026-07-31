import {
  DomainError,
  PermissionDeniedError,
  ResourceNotFoundError,
} from "../../../lib/domain-errors.ts";

type ProjectDatabaseError = {
  message?: string;
};

type ProjectOperation =
  | "create"
  | "rename"
  | "cover"
  | "delete"
  | "restore";

const operationFallbacks: Record<ProjectOperation, string> = {
  create: "作品を作成できませんでした。",
  rename: "作品情報を更新できませんでした。",
  cover: "表紙ページを設定できませんでした。",
  delete: "作品をゴミ箱へ移動できませんでした。",
  restore: "作品を復元できませんでした。",
};

export function mapCloudProjectError(
  error: ProjectDatabaseError | null | undefined,
  operation: ProjectOperation,
) {
  const signal = error?.message?.split(":", 1)[0];
  switch (signal) {
    case "cloud_project_not_editable":
      return new PermissionDeniedError(
        "この作品を編集する権限がありません。",
      );
    case "cover_page_not_found":
      return new ResourceNotFoundError("表紙ページが見つかりません。");
    case "cloud_project_not_found":
    case "cloud_project_restore_unavailable":
      return new ResourceNotFoundError("作品が見つかりません。");
    default:
      return new DomainError("INTERNAL_ERROR", operationFallbacks[operation], {
        cause: error,
      });
  }
}
