import { randomUUID } from "node:crypto";
import { createCloudMarketplaceArtifacts } from "@/lib/cloud-canvas-export";
import { assertCloudMarketplaceDraftMutable } from "@/lib/cloud-marketplace-policy";
import {
  generalCloudStoragePath,
  ownedMarketplaceStoragePath,
} from "@/lib/content-boundary";
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
};

async function findDraft(
  profileId: string,
  projectId: string,
): Promise<CloudMarketplaceDraft> {
  const supabase = await createClient();
  const { data: works, error: workError } = await supabase
    .from("works")
    .select("id,status,is_public,updated_at")
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
  if (!work) return { work: null, product: null };
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
  return { work, product: products?.[0] ?? null };
}

export async function getCloudMarketplaceDraft(projectId: string) {
  const { profile } = await requireProfile();
  return findDraft(profile.id, projectId);
}

export async function syncCloudMarketplaceDraft(input: {
  projectId: string;
  price: number;
}) {
  const { user, profile } = await requireProfile();
  const current = await findDraft(profile.id, input.projectId);
  assertCloudMarketplaceDraftMutable({
    workStatus: current.work?.status,
    workIsPublic: current.work?.is_public,
    productStatus: current.product?.status,
  });

  const artifacts = await createCloudMarketplaceArtifacts(input.projectId);
  if (artifacts.cover.byteLength > MAX_COVER_BYTES)
    throw new Error("表紙画像が10MBを超えています。");
  if (artifacts.pdf.byteLength > MAX_PRODUCT_BYTES)
    throw new Error("商品PDFが50MBを超えています。");

  const supabase = await createClient();
  const version = `r${artifacts.project.revision}-${randomUUID()}`;
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

    const { data: synced, error: syncError } = await supabase.rpc(
      "sync_cloud_marketplace_draft",
      {
        p_project_id: input.projectId,
        p_expected_revision: artifacts.project.revision,
        p_cover_url: coverPublic.publicUrl,
        p_product_path: productPath,
        p_price: input.price,
        p_sales_description: artifacts.description,
      },
    );
    const result = (synced ?? [])[0] as
      | { work_id: string; product_id: string }
      | undefined;
    if (syncError || !result)
      throw new Error(
        syncError?.message || "Marketplace下書きを保存できませんでした。",
      );
    const oldProductPath = current.product?.file_url;
    if (
      oldProductPath &&
      oldProductPath !== productPath &&
      (oldProductPath.startsWith(
        `${user.id.toLowerCase()}/${input.projectId.toLowerCase()}/`,
      ) ||
        oldProductPath.startsWith(
          generalCloudStoragePath(profile.id, "cloud", input.projectId),
        ))
    )
      await supabase.storage
        .from(PRODUCTS_BUCKET)
        .remove([oldProductPath])
        .catch(() => undefined);
    return { workId: result.work_id, productId: result.product_id };
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error;
  }
}
