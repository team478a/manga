import type { PageCanvas } from "@mangai/canvas-core";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "./canvas-normalizer";
import {
  findPage,
  findPageSnapshot,
  persistPageSnapshot,
} from "./canvas-repository";

export async function saveCloudPageSnapshot(input: {
  pageId: string;
  expectedRevision: number;
  canvas: PageCanvas;
}) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await persistPageSnapshot(supabase, input);
  if (error) {
    if (error.message.includes("revision_conflict"))
      throw new Error("保存競合を検出しました。Pageを再読込してください。");
    throw new Error("Pageを保存できませんでした。");
  }
  return data as { page_id: string; revision: number; updated_at: string }[];
}

export async function getCloudPageSnapshot(pageId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data: page, error } = await findPage(supabase, pageId);
  if (error || !page) throw new Error("Pageが見つかりません。");

  const { data: snapshot, error: snapshotError } = await findPageSnapshot(
    supabase,
    pageId,
    page.revision,
  );
  if (snapshotError) throw new Error("Canvasを読み込めませんでした。");
  return {
    ...page,
    canvas: normalizeCloudCanvas(page, snapshot?.canvas),
    snapshot,
  };
}
