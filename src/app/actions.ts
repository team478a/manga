"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createStripeCheckoutSession } from "@/lib/checkout";
import { normalizeBuyerEmail } from "@/lib/checkout-policy";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitTags } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ownedMarketplaceStoragePath } from "@/lib/content-boundary";

const WORKS_BUCKET = "works";
const DIGITAL_PRODUCTS_BUCKET = "digital-products";
const WORK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const WORK_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const DIGITAL_PRODUCT_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
];
const DIGITAL_PRODUCT_FILE_MAX_SIZE = 50 * 1024 * 1024;

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fileName(authUserId: string, resourceId: string, file: File) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  return ownedMarketplaceStoragePath(
    authUserId,
    resourceId,
    `${crypto.randomUUID()}-${safe}`,
  );
}

function validateWorkImage(file: FormDataEntryValue | null, required: boolean) {
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new Error("作品画像を選んでください。");
    return null;
  }

  if (!WORK_IMAGE_TYPES.includes(file.type)) {
    throw new Error("画像はJPG、PNG、WebPのいずれかを選んでください。");
  }

  if (file.size > WORK_IMAGE_MAX_SIZE) {
    throw new Error("画像サイズは10MB以内にしてください。");
  }

  return file;
}

function validateDigitalProductFile(
  file: FormDataEntryValue | null,
  required: boolean,
) {
  if (!(file instanceof File) || file.size === 0) {
    if (required) throw new Error("ダウンロード用ファイルを選んでください。");
    return null;
  }

  if (!DIGITAL_PRODUCT_FILE_TYPES.includes(file.type)) {
    throw new Error(
      "販売ファイルはPDF、PNG、JPG、ZIPのいずれかを選んでください。",
    );
  }

  if (file.size > DIGITAL_PRODUCT_FILE_MAX_SIZE) {
    throw new Error("販売ファイルのサイズは50MB以内にしてください。");
  }

  return file;
}

async function uploadIfPresent(
  bucket: string,
  file: FormDataEntryValue | null,
  authUserId: string,
  resourceId: string,
) {
  if (!(file instanceof File) || file.size === 0) return null;
  const supabase = await createClient();
  const path = fileName(authUserId, resourceId, file);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  if (bucket === WORKS_BUCKET) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  return path;
}

export async function signUp(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/signup?error=Supabaseの環境変数を設定すると新規登録できます。");
  }

  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    displayName: z.string().min(1),
  });
  const input = schema.safeParse({
    email: getText(formData, "email"),
    password: getText(formData, "password"),
    displayName: getText(formData, "displayName"),
  });

  if (!input.success) redirect("/signup?error=入力内容を確認してください");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: input.data.email,
    password: input.data.password,
    options: {
      data: {
        display_name: input.data.displayName,
      },
    },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect("/dashboard");
}

export async function signIn(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect("/login?error=Supabaseの環境変数を設定するとログインできます。");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: getText(formData, "email"),
    password: getText(formData, "password"),
  });

  if (error)
    redirect(
      `/login?error=${encodeURIComponent("メールアドレスまたはパスワードを確認してください")}`,
    );
  redirect("/dashboard");
}

export async function signOut() {
  if (!hasSupabaseEnv()) {
    redirect("/");
  }

  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: getText(formData, "displayName"),
      bio: getText(formData, "bio"),
    })
    .eq("id", profile.id);

  if (error) redirect(`/dashboard?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard");
  redirect("/dashboard?message=保存しました");
}

export async function createWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const title = getText(formData, "title");
  if (!title) redirect("/dashboard/works/new?error=作品名を入力してください");
  const workId = crypto.randomUUID();

  let imageUrl: string | null = null;
  try {
    const imageFile = validateWorkImage(formData.get("image"), true);
    imageUrl = await uploadIfPresent(
      WORKS_BUCKET,
      imageFile,
      user.id,
      workId,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "画像のアップロードに失敗しました。";
    redirect(`/dashboard/works/new?error=${encodeURIComponent(message)}`);
  }

  const isPublic =
    getText(formData, "visibility") === "public" ||
    getText(formData, "isPublic") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("works").insert({
    id: workId,
    creator_id: profile.id,
    title,
    description: getText(formData, "description"),
    image_url: imageUrl,
    tags: splitTags(formData.get("tags")),
    content_class: "general",
    status: isPublic ? "published" : "draft",
    is_public: isPublic,
  });

  if (error)
    redirect(`/dashboard/works/new?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/dashboard/works");
  revalidatePath("/works");
  redirect("/dashboard/works?message=作品を保存しました");
}

export async function updateWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = getText(formData, "id");
  const title = getText(formData, "title");
  if (!id || !title)
    redirect("/dashboard/works?error=作品を保存できませんでした");
  const supabase = await createClient();
  const { data: ownedWork } = await supabase
    .from("works")
    .select("id")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!ownedWork)
    redirect(
      "/dashboard/works?error=作品が見つからないか、編集権限がありません",
    );

  const update: Record<string, unknown> = {
    title,
    description: getText(formData, "description"),
    tags: splitTags(formData.get("tags")),
    is_public:
      getText(formData, "visibility") === "public" ||
      getText(formData, "isPublic") === "on",
    status:
      getText(formData, "visibility") === "public" ||
      getText(formData, "isPublic") === "on"
        ? "published"
        : "draft",
  };

  try {
    const imageFile = validateWorkImage(formData.get("image"), false);
    const imageUrl = await uploadIfPresent(
      WORKS_BUCKET,
      imageFile,
      user.id,
      id,
    );
    if (imageUrl) update.image_url = imageUrl;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "画像のアップロードに失敗しました。";
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(message)}`,
    );
  }

  const { error } = await supabase
    .from("works")
    .update(update)
    .eq("id", id)
    .eq("creator_id", profile.id);

  if (error)
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/dashboard/works");
  revalidatePath(`/works/${id}`);
  redirect("/dashboard/works?message=作品を更新しました");
}

export async function createDigitalProduct(formData: FormData) {
  const { user, profile } = await requireProfile();
  const title = getText(formData, "title");
  const workId = getText(formData, "workId");
  const price = Number(getText(formData, "price"));
  const status = getText(formData, "status") === "paused" ? "paused" : "active";
  const productId = crypto.randomUUID();

  if (!title || !workId || Number.isNaN(price) || price < 0) {
    redirect(
      "/dashboard/products/new?error=商品名、作品、価格を確認してください",
    );
  }

  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("id")
    .eq("id", workId)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!work) {
    redirect(
      "/dashboard/products/new?error=自分の作品だけを商品に紐づけできます",
    );
  }

  let filePath: string | null = null;
  try {
    const productFile = validateDigitalProductFile(formData.get("file"), true);
    filePath = await uploadIfPresent(
      DIGITAL_PRODUCTS_BUCKET,
      productFile,
      user.id,
      productId,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "販売ファイルのアップロードに失敗しました";
    redirect(`/dashboard/products/new?error=${encodeURIComponent(message)}`);
  }

  const { error } = await supabase.from("digital_products").insert({
    id: productId,
    work_id: workId,
    creator_id: profile.id,
    title,
    description: getText(formData, "description"),
    file_url: filePath,
    price,
    status,
  });

  if (error)
    redirect(
      `/dashboard/products/new?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?message=販売商品を登録しました");
}

export async function updateDigitalProduct(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = getText(formData, "id");
  const title = getText(formData, "title");
  const workId = getText(formData, "workId");
  const price = Number(getText(formData, "price"));
  const status = getText(formData, "status") === "paused" ? "paused" : "active";

  if (!id || !title || !workId || Number.isNaN(price) || price < 0) {
    redirect("/dashboard/products?error=商品情報を確認してください");
  }

  const supabase = await createClient();
  const [{ data: product }, { data: work }] = await Promise.all([
    supabase
      .from("digital_products")
      .select("id")
      .eq("id", id)
      .eq("creator_id", profile.id)
      .maybeSingle(),
    supabase
      .from("works")
      .select("id")
      .eq("id", workId)
      .eq("creator_id", profile.id)
      .eq("content_class", "general")
      .maybeSingle(),
  ]);

  if (!product) {
    redirect(
      "/dashboard/products?error=商品が見つからないか、編集権限がありません",
    );
  }

  if (!work) {
    redirect(
      `/dashboard/products/${id}/edit?error=自分の作品だけを商品に紐づけできます`,
    );
  }

  const update: Record<string, unknown> = {
    work_id: workId,
    title,
    description: getText(formData, "description"),
    price,
    status,
  };

  try {
    const productFile = validateDigitalProductFile(formData.get("file"), false);
    const filePath = await uploadIfPresent(
      DIGITAL_PRODUCTS_BUCKET,
      productFile,
      user.id,
      id,
    );
    if (filePath) update.file_url = filePath;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "販売ファイルのアップロードに失敗しました";
    redirect(
      `/dashboard/products/${id}/edit?error=${encodeURIComponent(message)}`,
    );
  }

  const { error } = await supabase
    .from("digital_products")
    .update(update)
    .eq("id", id)
    .eq("creator_id", profile.id);

  if (error)
    redirect(
      `/dashboard/products/${id}/edit?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/dashboard/products");
  redirect("/dashboard/products?message=販売商品を更新しました");
}

export async function createGoodsRequest(formData: FormData) {
  const { profile } = await requireProfile();
  const workId = getText(formData, "workId");
  const productType = getText(formData, "productType");

  if (!workId || !productType) {
    redirect(
      "/dashboard/goods-requests/new?error=作品とグッズの種類を選んでください",
    );
  }

  const supabase = await createClient();
  const { data: work } = await supabase
    .from("works")
    .select("id")
    .eq("id", workId)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!work) {
    redirect("/dashboard/goods-requests/new?error=自分の作品だけ申請できます");
  }

  const { error } = await supabase.from("goods_requests").insert({
    work_id: workId,
    creator_id: profile.id,
    product_type: productType,
    note: getText(formData, "note"),
    status: "pending",
  });

  if (error)
    redirect(
      `/dashboard/goods-requests/new?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/dashboard/goods-requests");
  redirect("/dashboard/goods-requests?message=グッズ販売申請を受け付けました");
}

export async function updateGoodsRequestAdmin(formData: FormData) {
  await requireAdmin();
  const id = getText(formData, "id");
  const status = getText(formData, "status");
  const allowedStatuses = [
    "pending",
    "approved",
    "rejected",
    "in_progress",
    "completed",
  ];

  if (!id || !allowedStatuses.includes(status)) {
    redirect("/admin/goods-requests?error=状態を確認してください");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("goods_requests")
    .update({
      status,
      admin_note: getText(formData, "adminNote"),
    })
    .eq("id", id);

  if (error)
    redirect(
      `/admin/goods-requests?error=${encodeURIComponent(error.message)}`,
    );
  revalidatePath("/admin/goods-requests");
  redirect("/admin/goods-requests?message=グッズ申請を更新しました");
}

export async function createPendingOrder(formData: FormData) {
  const productId = getText(formData, "productId");
  let buyerEmail = "";
  try {
    buyerEmail = normalizeBuyerEmail(getText(formData, "buyerEmail"));
  } catch {
    redirect(`/checkout/${productId}?error=メールアドレスを確認してください`);
  }

  if (!productId) {
    redirect(`/checkout/${productId}?error=メールアドレスを確認してください`);
  }

  if (!hasSupabaseAdminEnv()) {
    redirect(
      `/checkout/${productId}?error=Supabaseの管理用環境変数が設定されていません`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user: buyerUser },
  } = await supabase.auth.getUser();
  let buyerProfileId: string | null = null;
  if (
    buyerUser?.email &&
    normalizeBuyerEmail(buyerUser.email) === buyerEmail
  ) {
    const { data: buyerProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", buyerUser.id)
      .maybeSingle<{ id: string }>();
    buyerProfileId = buyerProfile?.id ?? null;
  }
  const { data: product } = await supabase
    .from("digital_products")
    .select("id,creator_id,price,status,works:work_id(id,is_public)")
    .eq("id", productId)
    .maybeSingle<{
      id: string;
      creator_id: string;
      price: number;
      status: string;
      works: { id: string; is_public: boolean } | null;
    }>();

  if (!product || product.status !== "active" || !product.works?.is_public) {
    redirect(`/checkout/${productId}?error=この商品は現在購入できません`);
  }

  const amount = Math.round(product.price);
  const platformFee = Math.floor(amount * 0.2);
  const creatorRevenue = amount - platformFee;

  const adminSupabase = createAdminClient();
  const { data: order, error } = await adminSupabase
    .from("orders")
    .insert({
      buyer_email: buyerEmail,
      buyer_profile_id: buyerProfileId,
      product_id: product.id,
      creator_id: product.creator_id,
      amount,
      platform_fee: platformFee,
      creator_revenue: creatorRevenue,
      status: "pending",
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !order) {
    redirect(`/checkout/${productId}?error=仮注文の作成に失敗しました`);
  }

  let checkoutUrl = "";
  try {
    const session = await createStripeCheckoutSession({
      orderId: order.id,
      productId: product.id,
      buyerEmail,
    });
    checkoutUrl = session.url ?? "";
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe Checkoutへの遷移に失敗しました。";
    redirect(
      `/checkout/${productId}?error=${encodeURIComponent(message)}&orderId=${order.id}`,
    );
  }
  redirect(checkoutUrl);
}
