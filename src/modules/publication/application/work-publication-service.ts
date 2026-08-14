import { getCurrentProfile, requireProfile } from "@/lib/auth";
import { ValidationError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WorkPublicationVersion = {
  id: string;
  version: number;
  checkpointId: string;
  pageCount: number;
  createdAt: string;
  current: boolean;
};

export async function listOwnedWorkPublications(workId: string) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const work = await supabase.from("works").select("id,current_publication_id")
    .eq("id", workId).eq("creator_id", profile.id).maybeSingle();
  if (work.error || !work.data) throw new ValidationError("作品の公開版を確認できませんでした。");
  const currentPublicationId = work.data.current_publication_id;
  const publications = await supabase.from("cloud_work_publications")
    .select("id,version,checkpoint_id,page_count,created_at")
    .eq("work_id", workId).order("version", { ascending: false });
  if (publications.error?.code === "42P01") return [] as WorkPublicationVersion[];
  if (publications.error) throw new ValidationError("作品の公開版履歴を確認できませんでした。");
  return (publications.data ?? []).map((row) => ({
    id: row.id,
    version: Number(row.version),
    checkpointId: row.checkpoint_id,
    pageCount: Number(row.page_count),
    createdAt: row.created_at,
    current: row.id === currentPublicationId,
  }));
}

export async function getReadableWorkPublication(workId: string, requestedPage: number) {
  const admin = createAdminClient();
  const { data: work } = await admin.from("works")
    .select("id,creator_id,title,is_public,status,current_publication_id")
    .eq("id", workId).eq("content_class", "general").maybeSingle();
  if (!work?.is_public || work.status !== "published" || !work.current_publication_id)
    throw new ValidationError("公開中の漫画原稿がありません。");
  const { profile } = await getCurrentProfile();
  const owner = profile?.id === work.creator_id;
  let purchased = false;
  if (profile && !owner) {
    const paid = await admin.from("orders").select("id,digital_products:product_id(work_id)")
      .eq("buyer_profile_id", profile.id).eq("status", "paid");
    purchased = (paid.data ?? []).some((row) => {
      const product = row.digital_products as unknown as { work_id?: string } | null;
      return product?.work_id === workId;
    });
  }
  const publication = await admin.from("cloud_work_publications")
    .select("id,version,page_count").eq("id", work.current_publication_id).eq("work_id", workId).maybeSingle();
  if (!publication.data) throw new ValidationError("公開版を確認できませんでした。");
  const pages = await admin.from("cloud_work_publication_pages")
    .select("page_number,width,height,storage_bucket,storage_path,is_sample")
    .eq("publication_id", publication.data.id).order("page_number");
  if (pages.error || pages.data?.length !== Number(publication.data.page_count))
    throw new ValidationError("公開版のページ一覧を確認できませんでした。");
  const allowed = owner || purchased ? pages.data : pages.data.filter((page) => page.is_sample);
  if (!allowed.length) throw new ValidationError("サンプルページは設定されていません。");
  const selected = allowed.find((page) => page.page_number === requestedPage) ?? allowed[0];
  const signed = await admin.storage.from(selected.storage_bucket).createSignedUrl(selected.storage_path, 300);
  if (signed.error || !signed.data?.signedUrl) throw new ValidationError("本文ページを表示できませんでした。");
  return {
    workTitle: work.title,
    publicationVersion: Number(publication.data.version),
    pageCount: Number(publication.data.page_count),
    accessiblePages: allowed.map((page) => page.page_number),
    pageNumber: selected.page_number,
    width: selected.width,
    height: selected.height,
    imageUrl: signed.data.signedUrl,
    fullAccess: owner || purchased,
  };
}
