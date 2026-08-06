import { createAdminClient } from "@/lib/supabase/admin";

export type ProductUpdateCategory =
  | "release"
  | "improvement"
  | "fix"
  | "maintenance";

export type ProductUpdateRecord = {
  id: string;
  title: string;
  summary: string;
  details: string | null;
  category: ProductUpdateCategory;
  action_url: string | null;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type EditableProductUpdate = Pick<
  ProductUpdateRecord,
  "id" | "title" | "summary" | "details" | "category" | "action_url"
>;

export type RecentProductUpdate = Pick<
  ProductUpdateRecord,
  "title" | "summary" | "details" | "category" | "action_url"
>;

export function listProductUpdates() {
  return createAdminClient()
    .from("cloud_product_updates")
    .select("id,title,summary,details,category,action_url,published_at,archived_at,created_at")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ProductUpdateRecord[]>();
}

export function findProductUpdate(updateId: string) {
  return createAdminClient()
    .from("cloud_product_updates")
    .select("id,title,summary,details,category,action_url")
    .eq("id", updateId)
    .is("archived_at", null)
    .maybeSingle<EditableProductUpdate>();
}

export function findRecentProductUpdates(
  actorProfileId: string,
  createdAfter: string,
) {
  return createAdminClient()
    .from("cloud_product_updates")
    .select("title,summary,details,category,action_url")
    .eq("created_by_profile_id", actorProfileId)
    .is("archived_at", null)
    .gte("created_at", createdAfter)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<RecentProductUpdate[]>();
}

export function insertProductUpdate(input: {
  title: string;
  summary: string;
  details: string | null;
  category: ProductUpdateCategory;
  actionUrl: string | null;
  publishedAt: string | null;
  actorProfileId: string;
}) {
  return createAdminClient().from("cloud_product_updates").insert({
    title: input.title,
    summary: input.summary,
    details: input.details,
    category: input.category,
    action_url: input.actionUrl,
    published_at: input.publishedAt,
    created_by_profile_id: input.actorProfileId,
  });
}

export function updateProductUpdateState(
  updateId: string,
  values: {
    published_at?: string | null;
    archived_at?: string | null;
    updated_at: string;
  },
) {
  return createAdminClient()
    .from("cloud_product_updates")
    .update(values)
    .eq("id", updateId);
}

export function editProductUpdate(input: {
  updateId: string;
  title: string;
  summary: string;
  details: string | null;
  category: ProductUpdateCategory;
  actionUrl: string | null;
  updatedAt: string;
}) {
  return createAdminClient()
    .from("cloud_product_updates")
    .update({
      title: input.title,
      summary: input.summary,
      details: input.details,
      category: input.category,
      action_url: input.actionUrl,
      updated_at: input.updatedAt,
    })
    .eq("id", input.updateId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
}
