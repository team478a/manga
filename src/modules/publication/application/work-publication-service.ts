import { getCurrentProfile, requireProfile } from "@/lib/auth";
import { ValidationError } from "@/lib/domain-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  loadMarketplaceReadingProgress,
  marketplaceReadingProgressKey,
  resolveMarketplaceReadingPage,
} from "@/lib/marketplace-reading-progress";
import { canReadFixedWorkPublication } from "@/modules/publication/domain/work-publication-access";

export type WorkPublicationVersion = {
  id: string;
  version: number;
  checkpointId: string;
  pageCount: number;
  createdAt: string;
  current: boolean;
};

export type WorkReaderEntitlement = {
  profileId: string | null;
  owner: boolean;
  purchased: boolean;
  purchasedPublicationIds: string[];
  fullAccess: boolean;
};

export async function getWorkReaderEntitlement(
  workId: string,
  creatorProfileId: string,
): Promise<WorkReaderEntitlement> {
  const { profile } = await getCurrentProfile();
  const owner = profile?.id === creatorProfileId;
  let purchased = false;
  let purchasedPublicationIds: string[] = [];

  if (profile && !owner) {
    const admin = createAdminClient();
    const paid = await admin
      .from("orders")
      .select("id,publication_id,paid_at,digital_products:product_id(work_id)")
      .eq("buyer_profile_id", profile.id)
      .eq("status", "paid")
      .order("paid_at", { ascending: false });
    let paidRows: Array<{
      publication_id: string | null;
      digital_products: unknown;
    }> = paid.data ?? [];
    if (paid.error && (paid.error.code === "42703" || paid.error.code === "PGRST204" || paid.error.message.includes("publication_id"))) {
      const legacyPaid = await admin
        .from("orders")
        .select("id,paid_at,digital_products:product_id(work_id)")
        .eq("buyer_profile_id", profile.id)
        .eq("status", "paid")
        .order("paid_at", { ascending: false });
      paidRows = (legacyPaid.data ?? []).map((row) => ({
        ...row,
        publication_id: null,
      }));
    }
    const matching = paidRows.filter((row) => {
      const product = row.digital_products as unknown as {
        work_id?: string;
      } | null;
      return product?.work_id === workId;
    });
    purchased = matching.length > 0;
    purchasedPublicationIds = matching.flatMap((row) =>
      typeof row.publication_id === "string" ? [row.publication_id] : [],
    );
  }

  return {
    profileId: profile?.id ?? null,
    owner,
    purchased,
    purchasedPublicationIds,
    fullAccess: owner || purchased,
  };
}

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

export async function getReadableWorkPublication(
  workId: string,
  requestedPage: number | null,
  requestedPublicationId: string | null = null,
) {
  const admin = createAdminClient();
  const { data: work } = await admin.from("works")
    .select("id,creator_id,title,is_public,status,current_publication_id")
    .eq("id", workId).eq("content_class", "general").maybeSingle();
  if (!work) throw new ValidationError("漫画原稿がありません。");
  const entitlement = await getWorkReaderEntitlement(workId, work.creator_id);
  if (!canReadFixedWorkPublication({
    currentPublicationId: work.current_publication_id,
    isPublic: work.is_public,
    owner: entitlement.owner,
    purchased: entitlement.purchased,
    status: work.status,
  }))
    throw new ValidationError("閲覧できる漫画原稿がありません。");
  const selectedPublicationId = entitlement.owner
    ? (requestedPublicationId ?? work.current_publication_id)
    : entitlement.purchased
      ? (requestedPublicationId &&
        entitlement.purchasedPublicationIds.includes(requestedPublicationId)
          ? requestedPublicationId
          : entitlement.purchasedPublicationIds.includes(work.current_publication_id)
            ? work.current_publication_id
            : entitlement.purchasedPublicationIds[0] ?? work.current_publication_id)
      : work.current_publication_id;
  if (
    requestedPublicationId &&
    !entitlement.owner &&
    requestedPublicationId !== work.current_publication_id &&
    !entitlement.purchasedPublicationIds.includes(requestedPublicationId)
  ) throw new ValidationError("閲覧できる公開版ではありません。");
  const publication = await admin.from("cloud_work_publications")
    .select("id,version,page_count").eq("id", selectedPublicationId).eq("work_id", workId).maybeSingle();
  if (!publication.data) throw new ValidationError("公開版を確認できませんでした。");
  const pages = await admin.from("cloud_work_publication_pages")
    .select("page_number,width,height,storage_bucket,storage_path,is_sample")
    .eq("publication_id", publication.data.id).order("page_number");
  if (pages.error || pages.data?.length !== Number(publication.data.page_count))
    throw new ValidationError("公開版のページ一覧を確認できませんでした。");
  const hasPurchasedSelectedPublication =
    entitlement.purchasedPublicationIds.includes(publication.data.id) ||
    (entitlement.purchased && entitlement.purchasedPublicationIds.length === 0);
  const fullAccess = entitlement.owner || hasPurchasedSelectedPublication;
  const allowed = fullAccess
    ? pages.data
    : pages.data.filter((page) => page.is_sample);
  if (!allowed.length) throw new ValidationError("サンプルページは設定されていません。");
  const accessiblePages = allowed.map((page) => Number(page.page_number));
  let savedPage: number | null = null;
  if (requestedPage === null && entitlement.profileId) {
    const progress = await loadMarketplaceReadingProgress(entitlement.profileId, [workId]);
    savedPage = progress.pagesByPublication.get(
      marketplaceReadingProgressKey(workId, publication.data.id),
    ) ?? null;
  }
  const selectedPageNumber = resolveMarketplaceReadingPage(
    accessiblePages,
    requestedPage,
    savedPage,
  );
  const selected = allowed.find((page) => page.page_number === selectedPageNumber) ?? allowed[0];
  const signed = await admin.storage.from(selected.storage_bucket).createSignedUrl(selected.storage_path, 300);
  if (signed.error || !signed.data?.signedUrl) throw new ValidationError("本文ページを表示できませんでした。");
  return {
    workTitle: work.title,
    publicationId: publication.data.id,
    publicationVersion: Number(publication.data.version),
    pageCount: Number(publication.data.page_count),
    accessiblePages,
    pageNumber: selected.page_number,
    width: selected.width,
    height: selected.height,
    imageUrl: signed.data.signedUrl,
    fullAccess,
    persistProgress: Boolean(entitlement.profileId),
    resumedFromProgress: requestedPage === null && savedPage === selected.page_number,
  };
}
