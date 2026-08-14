import { randomUUID } from "node:crypto";
import { createCloudMarketplaceArtifacts } from "@/lib/cloud-canvas-export";
import { assertCloudMarketplaceDraftMutable } from "@/lib/cloud-marketplace-policy";
import { ownedMarketplaceStoragePath } from "@/lib/content-boundary";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const WORKS_BUCKET = "works";
const PRODUCTS_BUCKET = "digital-products";
const MAX_COVER_BYTES = 10 * 1024 * 1024;
const MAX_PRODUCT_BYTES = 50 * 1024 * 1024;

type DraftWork = {
  id: string;
  status: string;
  is_public: boolean;
  updated_at: string;
  current_publication_id: string | null;
  published_version: number | null;
};

type DraftProduct = {
  id: string;
  status: string;
  price: number;
  file_url: string | null;
  updated_at: string;
};

export type CloudMarketplaceDraft = {
  work: DraftWork | null;
  product: DraftProduct | null;
  publications: Array<{ id: string; version: number; checkpointId: string; pageCount: number; createdAt: string }>;
};

async function findDraft(
  profileId: string,
  projectId: string,
): Promise<CloudMarketplaceDraft> {
  const supabase = await createClient();
  const { data: works, error: workError } = await supabase
    .from("works")
    .select("id,status,is_public,updated_at,current_publication_id,published_version")
    .eq("creator_id", profileId)
    .eq("source_project_id", projectId)
    .order("id", { ascending: true })
    .limit(2)
    .returns<DraftWork[]>();
  if (workError) throw new Error("販売用作品の状態を確認できませんでした。");
  if ((works ?? []).length > 1)
    throw new Error(
      "同じProjectに紐づく作品が複数あります。作品管理で整理してください。",
    );
  const work = works?.[0] ?? null;
  if (!work) return { work: null, product: null, publications: [] };
  const { data: products, error: productError } = await supabase
    .from("digital_products")
    .select("id,status,price,file_url,updated_at")
    .eq("creator_id", profileId)
    .eq("work_id", work.id)
    .order("id", { ascending: true })
    .limit(2)
    .returns<DraftProduct[]>();
  if (productError)
    throw new Error("販売用商品の状態を確認できませんでした。");
  if ((products ?? []).length > 1)
    throw new Error(
      "作品に紐づく商品が複数あります。商品管理で整理してください。",
    );
  const { data: publications, error: publicationError } = await supabase
    .from("cloud_work_publications")
    .select("id,version,checkpoint_id,page_count,created_at")
    .eq("work_id", work.id)
    .order("version", { ascending: false });
  if (publicationError?.code !== "42P01" && publicationError)
    throw new Error("公開版の履歴を確認できませんでした。");
  return {
    work,
    product: products?.[0] ?? null,
    publications: (publications ?? []).map((row) => ({
      id: row.id, version: Number(row.version), checkpointId: row.checkpoint_id,
      pageCount: Number(row.page_count), createdAt: row.created_at,
    })),
  };
}

export async function getCloudMarketplaceDraft(projectId: string) {
  const { profile } = await requireProfile();
  return findDraft(profile.id, projectId);
}

export async function syncCloudMarketplaceDraft(input: {
  projectId: string;
  checkpointId: string;
  price: number;
}) {
  const { user, profile } = await requireProfile();
  const current = await findDraft(profile.id, input.projectId);
  assertCloudMarketplaceDraftMutable({
    workStatus: current.work?.status,
    workIsPublic: current.work?.is_public,
    productStatus: current.product?.status,
  });

  const artifacts = await createCloudMarketplaceArtifacts(input.projectId, input.checkpointId);
  if (!artifacts.checkpoint) throw new Error("完成版を販売原稿へ固定できませんでした。");
  if (artifacts.cover.byteLength > MAX_COVER_BYTES)
    throw new Error("表紙画像が10MBを超えています。");
  if (artifacts.pdf.byteLength > MAX_PRODUCT_BYTES)
    throw new Error("商品PDFが50MBを超えています。");

  const supabase = await createClient();
  const version = `release-${artifacts.checkpoint.id}-${randomUUID()}`;
  const coverPath = ownedMarketplaceStoragePath(
    user.id,
    input.projectId,
    `${version}-cover.png`,
  );
  const productPath = ownedMarketplaceStoragePath(
    user.id,
    input.projectId,
    `${version}-main.pdf`,
  );
  const pagePaths = artifacts.pages.map((_page, index) => ownedMarketplaceStoragePath(
    user.id, input.projectId, `${version}-page-${String(index + 1).padStart(3, "0")}.png`,
  ));
  const uploaded: Array<{ bucket: string; path: string }> = [];
  const cleanup = async () =>
    Promise.all(
      uploaded.map(({ bucket, path }) =>
        supabase.storage.from(bucket).remove([path]),
      ),
    );

  try {
    const { error: coverError } = await supabase.storage
      .from(WORKS_BUCKET)
      .upload(coverPath, artifacts.cover, {
        contentType: "image/png",
        upsert: false,
      });
    if (coverError) throw new Error(coverError.message);
    uploaded.push({ bucket: WORKS_BUCKET, path: coverPath });
    const { data: coverPublic } = supabase.storage
      .from(WORKS_BUCKET)
      .getPublicUrl(coverPath);

    const { error: productUploadError } = await supabase.storage
      .from(PRODUCTS_BUCKET)
      .upload(productPath, artifacts.pdf, {
        contentType: "application/pdf",
        upsert: false,
      });
    if (productUploadError) throw new Error(productUploadError.message);
    uploaded.push({ bucket: PRODUCTS_BUCKET, path: productPath });

    for (let index = 0; index < artifacts.pages.length; index += 1) {
      const { error } = await supabase.storage.from(PRODUCTS_BUCKET).upload(
        pagePaths[index], artifacts.pages[index].bytes, { contentType: "image/png", upsert: false },
      );
      if (error) throw new Error(error.message);
      uploaded.push({ bucket: PRODUCTS_BUCKET, path: pagePaths[index] });
    }

    const { data: synced, error: syncError } = await supabase.rpc(
      "sync_cloud_marketplace_release_draft",
      {
        p_project_id: input.projectId,
        p_checkpoint_id: artifacts.checkpoint.id,
        p_manifest_sha256: artifacts.checkpoint.manifestSha256,
        p_cover_url: coverPublic.publicUrl,
        p_product_path: productPath,
        p_pages: artifacts.pages.map((page, index) => ({
          pageNumber: Number(page.pageNumber), width: page.width, height: page.height,
          storagePath: pagePaths[index], isSample: index === 0,
        })),
        p_price: input.price,
        p_sales_description: artifacts.description,
      },
    );
    const result = (synced ?? [])[0] as
      | { work_id: string; product_id: string; publication_id: string; publication_version: number }
      | undefined;
    if (syncError || !result)
      throw new Error(
        syncError?.message || "Marketplace下書きを保存できませんでした。",
      );
    return { workId: result.work_id, productId: result.product_id,
      publicationId: result.publication_id, publicationVersion: Number(result.publication_version) };
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error;
  }
}

export async function selectCloudWorkPublication(input: { workId: string; publicationId: string }) {
  await requireProfile();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("select_cloud_work_publication", {
    p_work_id: input.workId,
    p_publication_id: input.publicationId,
  });
  if (error?.message?.includes("in_use"))
    throw new Error("公開・販売を停止してから完成版を切り替えてください。");
  if (error || !data) throw new Error("完成版を切り替えできませんでした。");
}
