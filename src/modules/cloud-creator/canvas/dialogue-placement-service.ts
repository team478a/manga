import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";

export type CloudPageDialoguePlacement = {
  status: "auto_placed" | "review_required" | "placement_failed";
  dialogue_count: number;
  placed_dialogue_count: number;
  blocker_codes: string[];
  applied_page_revision: number | null;
};

export async function getCloudPageDialoguePlacement(pageId: string) {
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase
    .from("cloud_page_dialogue_placements")
    .select(
      "status,dialogue_count,placed_dialogue_count,blocker_codes,applied_page_revision",
    )
    .eq("page_id", pageId)
    .maybeSingle();
  if (error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "セリフ配置状態を読み込めませんでした。",
      { cause: error },
    );
  return (data ?? null) as CloudPageDialoguePlacement | null;
}
