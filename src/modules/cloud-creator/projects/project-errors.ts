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
  create: "Cloud Projectを作成できませんでした。",
  rename: "Project情報を更新できませんでした。",
  cover: "表紙Pageを設定できませんでした。",
  delete: "Cloud Projectをゴミ箱へ移動できませんでした。",
  restore: "Cloud Projectを復元できませんでした。",
};

export function mapCloudProjectError(
  error: ProjectDatabaseError | null | undefined,
  operation: ProjectOperation,
) {
  const signal = error?.message?.split(":", 1)[0];
  switch (signal) {
    case "cloud_project_not_editable":
      return new PermissionDeniedError(
        "このCloud Projectを編集する権限がありません。",
      );
    case "cover_page_not_found":
      return new ResourceNotFoundError("表紙Pageが見つかりません。");
    case "cloud_project_not_found":
    case "cloud_project_restore_unavailable":
      return new ResourceNotFoundError("Cloud Projectが見つかりません。");
    default:
      return new DomainError("INTERNAL_ERROR", operationFallbacks[operation], {
        cause: error,
      });
  }
}
