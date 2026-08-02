import type { PageCanvas } from "@mangai/canvas-core";
import type { CloudCreatorClient } from "../auth-context";
import {
  DomainError,
  ResourceNotFoundError,
  RevisionConflictError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

type CanvasDatabaseError = {
  message?: string;
};

export function mapCanvasPersistenceError(error: CanvasDatabaseError) {
  const signal = error.message?.split(":", 1)[0];
  switch (signal) {
    case "revision_conflict":
      return new RevisionConflictError(
        "別のタブまたは端末で同じページが更新されました。最新状態を確認してください。",
      );
    case "page_not_found":
      return new ResourceNotFoundError("ページが見つかりません。");
    case "invalid_snapshot_input":
      return new ValidationError("Canvas snapshotが不正です。");
    default:
      return new DomainError(
        "INTERNAL_ERROR",
        "ページを保存できませんでした。",
        { cause: error },
      );
  }
}

export function persistPageSnapshot(
  supabase: CloudCreatorClient,
  input: {
    pageId: string;
    expectedRevision: number;
    canvas: PageCanvas;
  },
) {
  return supabase.rpc("save_cloud_page_snapshot", {
    p_page_id: input.pageId,
    p_expected_revision: input.expectedRevision,
    p_canvas: input.canvas,
  });
}

export function findPage(supabase: CloudCreatorClient, pageId: string) {
  return supabase
    .from("cloud_pages")
    .select("id,project_id,page_number,revision,width,height,background_color,updated_at")
    .eq("id", pageId)
    .is("deleted_at", null)
    .single();
}

export function findPageSnapshot(
  supabase: CloudCreatorClient,
  pageId: string,
  revision: number,
) {
  return supabase
    .from("cloud_canvas_snapshots")
    .select("revision,canvas,created_at")
    .eq("page_id", pageId)
    .eq("revision", revision)
    .maybeSingle();
}
