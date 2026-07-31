import type { PageCanvas } from "@mangai/canvas-core";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "./canvas-normalizer";
import {
  findPage,
  findPageSnapshot,
  mapCanvasPersistenceError,
  persistPageSnapshot,
} from "./canvas-repository";
import { DomainError, ResourceNotFoundError } from "@/lib/domain-errors";

export async function saveCloudPageSnapshot(input: {
  pageId: string;
  expectedRevision: number;
  canvas: PageCanvas;
}) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await persistPageSnapshot(supabase, input);
  if (error) throw mapCanvasPersistenceError(error);
  return data as { page_id: string; revision: number; updated_at: string }[];
}

export async function getCloudPageSnapshot(pageId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data: page, error } = await findPage(supabase, pageId);
  if (error || !page)
    throw new ResourceNotFoundError("ページが見つかりません。");

  const { data: snapshot, error: snapshotError } = await findPageSnapshot(
    supabase,
    pageId,
    page.revision,
  );
  if (snapshotError)
    throw new DomainError("INTERNAL_ERROR", "Canvasを読み込めませんでした。", {
      cause: snapshotError,
    });
  return {
    ...page,
    canvas: normalizeCloudCanvas(page, snapshot?.canvas),
    snapshot,
  };
}
