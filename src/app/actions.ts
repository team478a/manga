"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import sharp from "sharp";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { createStripeCheckoutSession } from "@/lib/checkout";
import { normalizeBuyerEmail } from "@/lib/checkout-policy";
import { hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { splitTags } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ownedMarketplaceStoragePath } from "@/lib/content-boundary";
import {
  firstValidationMessage,
  normalizeCreatorTags,
  profileInputSchema,
  workInputSchema,
} from "@/lib/creator-input";

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
const passwordSchema = z.string().min(8);

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

async function validateWorkImage(
  file: FormDataEntryValue | null,
  required: boolean,
) {
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

  try {
    const metadata = await sharp(await file.arrayBuffer()).metadata();
    const expectedFormat: Record<string, string> = {
      "image/jpeg": "jpeg",
      "image/png": "png",
      "image/webp": "webp",
    };
    if (
      metadata.format !== expectedFormat[file.type] ||
      !metadata.width ||
      !metadata.height
    ) {
      throw new Error("invalid image");
    }
  } catch {
    throw new Error(
      "画像ファイルを確認できませんでした。正しいJPG、PNG、WebPを選んでください。",
    );
  }

  return file;
}

async function uploadWorkImage(
  file: File,
  authUserId: string,
  workId: string,
) {
  const supabase = await createClient();
  const path = fileName(authUserId, workId, file);
  const { error } = await supabase.storage
    .from(WORKS_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) throw new Error("画像のアップロードに失敗しました。");

  const { data } = supabase.storage.from(WORKS_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

async function removeWorkImage(path: string) {
  const supabase = await createClient();
  await supabase.storage.from(WORKS_BUCKET).remove([path]);
}

function ownedWorkImagePath(
  publicUrl: string | null,
  authUserId: string,
  workId: string,
) {
  if (!publicUrl) return null;
  try {
    const marker = `/storage/v1/object/public/${WORKS_BUCKET}/`;
    const pathname = new URL(publicUrl).pathname;
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex < 0) return null;
    const path = decodeURIComponent(pathname.slice(markerIndex + marker.length));
    const ownedPrefix = `${authUserId.toLowerCase()}/${workId.toLowerCase()}/`;
    return path.toLowerCase().startsWith(ownedPrefix) ? path : null;
  } catch {
    return null;
  }
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

  const schema = z
    .object({
      email: z.string().email(),
      password: passwordSchema,
      passwordConfirmation: passwordSchema,
      displayName: z.string().min(1),
    })
    .refine((value) => value.password === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
    });
  const input = schema.safeParse({
    email: getText(formData, "email"),
    password: getText(formData, "password"),
    passwordConfirmation: getText(formData, "passwordConfirmation"),
    displayName: getText(formData, "displayName"),
  });

  if (!input.success) {
    redirect(
      `/signup?error=${encodeURIComponent("入力内容を確認してください。パスワードは8文字以上で、確認欄にも同じ内容を入力してください。")}`,
    );
  }

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

  if (error) {
    redirect(
      `/signup?error=${encodeURIComponent("新規登録できませんでした。入力内容または登録状況を確認してください。")}`,
    );
  }
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

async function requestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : host?.startsWith("localhost")
        ? "http"
        : "https";

  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    return null;
  }

  return `${protocol}://${host}`;
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Supabaseの環境変数を設定するとパスワードを再設定できます。")}`,
    );
  }

  const email = z.string().email().safeParse(getText(formData, "email"));
  if (!email.success) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("メールアドレスを確認してください。")}`,
    );
  }

  const origin = await requestOrigin();
  if (!origin) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("再設定用URLを作成できませんでした。時間をおいて再度お試しください。")}`,
    );
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  redirect(
    `/login?message=${encodeURIComponent("登録済みの場合は、パスワード再設定メールを送信しました。メールをご確認ください。")}`,
  );
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabaseEnv()) {
    redirect(
      `/update-password?error=${encodeURIComponent("Supabaseの環境変数を設定するとパスワードを更新できます。")}`,
    );
  }

  const input = z
    .object({
      password: passwordSchema,
      passwordConfirmation: passwordSchema,
    })
    .refine((value) => value.password === value.passwordConfirmation, {
      path: ["passwordConfirmation"],
    })
    .safeParse({
      password: getText(formData, "password"),
      passwordConfirmation: getText(formData, "passwordConfirmation"),
    });

  if (!input.success) {
    redirect(
      `/update-password?error=${encodeURIComponent("パスワードは8文字以上で、確認欄にも同じ内容を入力してください。")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("再設定リンクが無効または期限切れです。もう一度メールを送信してください。")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: input.data.password,
  });
  if (error) {
    redirect(
      `/update-password?error=${encodeURIComponent("パスワードを更新できませんでした。再設定メールからやり直してください。")}`,
    );
  }

  await supabase.auth.signOut();
  redirect(
    `/login?message=${encodeURIComponent("パスワードを更新しました。新しいパスワードでログインしてください。")}`,
  );
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
  const input = profileInputSchema.safeParse({
    displayName: getText(formData, "displayName"),
    bio: getText(formData, "bio"),
  });
  if (!input.success) {
    redirect(
      `/dashboard?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: input.data.displayName,
      bio: input.data.bio,
    })
    .eq("id", profile.id);

  if (error)
    redirect("/dashboard?error=プロフィールを保存できませんでした");
  revalidatePath("/dashboard");
  redirect("/dashboard?message=保存しました");
}

export async function createWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const input = workInputSchema.safeParse({
    title: getText(formData, "title"),
    description: getText(formData, "description"),
    tags: normalizeCreatorTags(formData.get("tags")),
    visibility:
      getText(formData, "visibility") === "public" ? "public" : "private",
  });
  if (!input.success) {
    redirect(
      `/dashboard/works/new?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }
  const workId = crypto.randomUUID();

  let uploadedImage: { path: string; publicUrl: string } | null = null;
  try {
    const imageFile = await validateWorkImage(formData.get("image"), true);
    if (!imageFile) throw new Error("作品画像を選んでください。");
    uploadedImage = await uploadWorkImage(imageFile, user.id, workId);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "画像のアップロードに失敗しました。";
    redirect(`/dashboard/works/new?error=${encodeURIComponent(message)}`);
  }

  const isPublic = input.data.visibility === "public";
  const supabase = await createClient();
  const { error } = await supabase.from("works").insert({
    id: workId,
    creator_id: profile.id,
    title: input.data.title,
    description: input.data.description,
    image_url: uploadedImage.publicUrl,
    tags: input.data.tags,
    content_class: "general",
    status: isPublic ? "published" : "draft",
    is_public: isPublic,
  });

  if (error) {
    await removeWorkImage(uploadedImage.path);
    redirect("/dashboard/works/new?error=作品を保存できませんでした");
  }
  revalidatePath("/dashboard/works");
  revalidatePath("/works");
  redirect("/dashboard/works?message=作品を保存しました");
}

export async function updateWork(formData: FormData) {
  const { user, profile } = await requireProfile();
  const id = getText(formData, "id");
  if (!id)
    redirect("/dashboard/works?error=作品を保存できませんでした");
  const input = workInputSchema.safeParse({
    title: getText(formData, "title"),
    description: getText(formData, "description"),
    tags: normalizeCreatorTags(formData.get("tags")),
    visibility:
      getText(formData, "visibility") === "public" ? "public" : "private",
  });
  if (!input.success) {
    redirect(
      `/dashboard/works/${id}/edit?error=${encodeURIComponent(firstValidationMessage(input.error))}`,
    );
  }
  const supabase = await createClient();
  const { data: ownedWork } = await supabase
    .from("works")
    .select("id,image_url")
    .eq("id", id)
    .eq("creator_id", profile.id)
    .eq("content_class", "general")
    .maybeSingle();
  if (!ownedWork)
    redirect(
      "/dashboard/works?error=作品が見つからないか、編集権限がありません",
    );

  const update: Record<string, unknown> = {
    title: input.data.title,
    description: input.data.description,
    tags: input.data.tags,
    is_public: input.data.visibility === "public",
    status: input.data.visibility === "public" ? "published" : "draft",
  };

  let uploadedImage: { path: string; publicUrl: string } | null = null;
  try {
    const imageFile = await validateWorkImage(formData.get("image"), false);
    if (imageFile) {
      uploadedImage = await uploadWorkImage(imageFile, user.id, id);
      update.image_url = uploadedImage.publicUrl;
    }
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

  if (error) {
    if (uploadedImage) await removeWorkImage(uploadedImage.path);
    redirect(
      `/dashboard/works/${id}/edit?error=作品を保存できませんでした`,
    );
  }
  if (uploadedImage) {
    const previousPath = ownedWorkImagePath(ownedWork.image_url, user.id, id);
    if (previousPath) await removeWorkImage(previousPath);
  }
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
