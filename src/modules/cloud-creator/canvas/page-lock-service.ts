import { cloudCreatorContext } from "../auth-context";
import { DomainError, RevisionConflictError } from "@/lib/domain-errors";

export async function acquireCloudPageEditLock(pageId: string, lockToken: string) {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("acquire_cloud_page_edit_lock", { p_page_id: pageId, p_lock_token: lockToken, p_lease_seconds: 120 });
  if (result.error?.code === "42883") return null;
  if (result.error?.message?.includes("cloud_page_locked")) throw new RevisionConflictError("このページは別の画面で編集中です。");
  if (result.error?.message?.includes("cloud_page_finalized")) throw new RevisionConflictError("確定済みページです。制作ボードで編集を再開してください。");
  if (result.error || !result.data) throw new DomainError("INTERNAL_ERROR", "ページの編集状態を確認できませんでした。", { cause: result.error });
  return result.data as string;
}

export async function releaseCloudPageEditLock(pageId: string, lockToken: string) {
  const { supabase } = await cloudCreatorContext();
  const result = await supabase.rpc("release_cloud_page_edit_lock", { p_page_id: pageId, p_lock_token: lockToken });
  if (result.error?.code === "42883") return false;
  if (result.error) throw new DomainError("INTERNAL_ERROR", "ページの編集状態を解除できませんでした。", { cause: result.error });
  return Boolean(result.data);
}
