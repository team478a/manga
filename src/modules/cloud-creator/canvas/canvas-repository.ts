import type { PageCanvas } from "@mangai/canvas-core";
import type { CloudCreatorClient } from "../auth-context";

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
    .select("id,project_id,revision,width,height,background_color,updated_at")
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
