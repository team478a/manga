"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  parseSalesPackageManifest,
  type SalesPackageFileRole,
  type SalesPackageManifest,
} from "@mangai/export-core";
import { safeDomainErrorMessage } from "@/lib/api-errors";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  assertGeneralSalesPackage,
  ownedMarketplaceStoragePath,
} from "@/lib/content-boundary";
import {
  DomainError,
  PayloadTooLargeError,
  StorageTransactionError,
  ValidationError,
} from "@/lib/domain-errors";

const WORKS_BUCKET = "works";
const PRODUCTS_BUCKET = "digital-products";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PRODUCT_BYTES = 50 * 1024 * 1024;

export type SalesPackageImportResult =
  | { ok: true; workId: string; productId: string }
  | { ok: false; message: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function file(formData: FormData, key: string) {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

function declaredFile(
  manifest: SalesPackageManifest,
  role: SalesPackageFileRole,
) {
  const matches = manifest.files.filter((entry) => entry.role === role);
  if (matches.length !== 1)
    throw new ValidationError(`${role}は販売パッケージに1件必要です。`);
  return matches[0];
}

async function verifyFile(
  upload: File,
  declared: SalesPackageManifest["files"][number],
) {
  if (upload.size !== declared.byteSize)
    throw new ValidationError(
      `${declared.path}のサイズがmanifestと一致しません。`,
    );
  const bytes = Buffer.from(await upload.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== declared.sha256)
    throw new ValidationError(
      `${declared.path}のSHA-256がmanifestと一致しません。`,
    );
  return bytes;
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function hasImageSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp")
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  return false;
}

export async function importSalesPackageDraft(
  formData: FormData,
): Promise<SalesPackageImportResult> {
  try {
    const { user, profile } = await requireProfile();
    const input = z
      .object({
        title: z.string().trim().min(1).max(200),
        description: z.string().max(5000),
        productTitle: z.string().trim().min(1).max(200),
        productDescription: z.string().max(5000),
        price: z.coerce.number().int().min(0).max(1_000_000),
        productRole: z.enum(["product_pdf", "page_images_zip"]),
      })
      .parse({
        title: text(formData, "title"),
        description: text(formData, "description"),
        productTitle: text(formData, "productTitle"),
        productDescription: text(formData, "productDescription"),
        price: text(formData, "price"),
        productRole: text(formData, "productRole"),
      });

    let manifest: SalesPackageManifest;
    try {
      manifest = parseSalesPackageManifest(
        JSON.parse(text(formData, "manifest")),
      );
      assertGeneralSalesPackage(manifest);
    } catch {
      throw new ValidationError(
        "販売パッケージのmanifestを再検証できませんでした。",
      );
    }
    const productUpload = file(formData, "product");
    if (!productUpload)
      throw new ValidationError("商品ファイルがありません。");
    const productDeclared = declaredFile(manifest, input.productRole);
    if (productDeclared.byteSize > MAX_PRODUCT_BYTES)
      throw new PayloadTooLargeError(
        "商品ファイルは50MB以内にしてください。",
      );
    if (
      input.productRole === "product_pdf" &&
      productDeclared.mimeType !== "application/pdf"
    )
      throw new ValidationError("商品PDFのMIME typeが不正です。");
    if (
      input.productRole === "page_images_zip" &&
      productDeclared.mimeType !== "application/zip"
    )
      throw new ValidationError("連番画像ZIPのMIME typeが不正です。");
    const productBytes = await verifyFile(productUpload, productDeclared);
    if (
      input.productRole === "product_pdf" &&
      productBytes.subarray(0, 4).toString("ascii") !== "%PDF"
    )
      throw new ValidationError("商品PDFの内容を確認できません。");
    if (
      input.productRole === "page_images_zip" &&
      !productBytes.subarray(0, 2).equals(Buffer.from("PK"))
    )
      throw new ValidationError("連番画像ZIPの内容を確認できません。");

    const coverDeclared = manifest.files.filter(
      (entry) => entry.role === "cover",
    );
    if (coverDeclared.length > 1)
      throw new ValidationError("表紙ファイルが複数あります。");
    const coverUpload = file(formData, "cover");
    if (Boolean(coverUpload) !== Boolean(coverDeclared[0]))
      throw new ValidationError(
        "表紙ファイルがmanifestと一致しません。",
      );
    const sampleDeclared = manifest.files.filter(
      (entry) => entry.role === "sample",
    );
    if (sampleDeclared.length > 3)
      throw new ValidationError("サンプル画像は3枚までです。");
    const sampleUploads = [0, 1, 2]
      .map((index) => file(formData, `sample${index}`))
      .filter((value): value is File => Boolean(value));
    if (sampleUploads.length !== sampleDeclared.length)
      throw new ValidationError(
        "サンプル画像がmanifestと一致しません。",
      );

    const imageInputs: Array<{
      file: File;
      declared: SalesPackageManifest["files"][number];
      kind: "cover" | "sample";
    }> = [
      ...(coverUpload && coverDeclared[0]
        ? [
            {
              file: coverUpload,
              declared: coverDeclared[0],
              kind: "cover" as const,
            },
          ]
        : []),
      ...sampleUploads.map((sample, index) => ({
        file: sample,
        declared: sampleDeclared[index],
        kind: "sample" as const,
      })),
    ];
    const verifiedImages = await Promise.all(
      imageInputs.map(async (image) => {
        if (image.declared.byteSize > MAX_IMAGE_BYTES)
          throw new PayloadTooLargeError(
            `${image.declared.path}は10MB以内にしてください。`,
          );
        if (!IMAGE_TYPES.includes(image.declared.mimeType))
          throw new ValidationError(
            `${image.declared.path}はJPG、PNG、WebPにしてください。`,
          );
        const bytes = await verifyFile(image.file, image.declared);
        if (!hasImageSignature(bytes, image.declared.mimeType))
          throw new ValidationError(
            `${image.declared.path}の画像形式を確認できません。`,
          );
        return { ...image, bytes };
      }),
    );

    const supabase = await createClient();
    const workId = randomUUID();
    const productId = randomUUID();
    const uploaded: Array<{ bucket: string; path: string }> = [];
    const cleanup = async () => {
      await Promise.all(
        uploaded.map(({ bucket, path }) =>
          supabase.storage.from(bucket).remove([path]),
        ),
      );
    };
    try {
      let coverUrl: string | null = null;
      const sampleUrls: string[] = [];
      for (const image of verifiedImages) {
        const storagePath = ownedMarketplaceStoragePath(
          user.id,
          workId,
          `${randomUUID()}.${imageExtension(image.declared.mimeType)}`,
        );
        const { error } = await supabase.storage
          .from(WORKS_BUCKET)
          .upload(storagePath, image.bytes, {
            contentType: image.declared.mimeType,
            upsert: false,
          });
        if (error)
          throw new StorageTransactionError(
            "作品画像をStorageへ保存できませんでした。",
          );
        uploaded.push({ bucket: WORKS_BUCKET, path: storagePath });
        const { data } = supabase.storage
          .from(WORKS_BUCKET)
          .getPublicUrl(storagePath);
        if (image.kind === "cover") coverUrl = data.publicUrl;
        else sampleUrls.push(data.publicUrl);
      }

      const productExtension =
        input.productRole === "product_pdf" ? "pdf" : "zip";
      const productPath = ownedMarketplaceStoragePath(
        user.id,
        productId,
        `${randomUUID()}.${productExtension}`,
      );
      const { error: uploadError } = await supabase.storage
        .from(PRODUCTS_BUCKET)
        .upload(productPath, productBytes, {
          contentType: productDeclared.mimeType,
          upsert: false,
        });
      if (uploadError)
        throw new StorageTransactionError(
          "商品ファイルをStorageへ保存できませんでした。",
        );
      uploaded.push({ bucket: PRODUCTS_BUCKET, path: productPath });

      const { data: work, error: workError } = await supabase
        .from("works")
        .insert({
          id: workId,
          creator_id: profile.id,
          title: input.title,
          description: input.description,
          image_url: coverUrl,
          sample_image_urls: sampleUrls,
          source_project_id: manifest.work.sourceProjectId,
          content_class: "general",
          tags: [manifest.work.genre, manifest.work.ageRating].filter(Boolean),
          status: "draft",
          is_public: false,
        })
        .select("id")
        .single<{ id: string }>();
      if (workError || !work)
        throw new DomainError(
          "INTERNAL_ERROR",
          "作品下書きを作成できませんでした。",
          { cause: workError },
        );

      const { data: product, error: productError } = await supabase
        .from("digital_products")
        .insert({
          id: productId,
          work_id: work.id,
          creator_id: profile.id,
          title: input.productTitle,
          description: input.productDescription,
          file_url: productPath,
          price: input.price,
          status: "paused",
        })
        .select("id")
        .single<{ id: string }>();
      if (productError || !product) {
        await supabase.from("works").delete().eq("id", work.id);
        throw new DomainError(
          "INTERNAL_ERROR",
          "商品下書きを作成できませんでした。",
          { cause: productError },
        );
      }
      revalidatePath("/dashboard");
      revalidatePath("/dashboard/works");
      revalidatePath("/dashboard/products");
      return { ok: true, workId: work.id, productId: product.id };
    } catch (cause) {
      await cleanup().catch(() => undefined);
      throw cause;
    }
  } catch (cause) {
    return {
      ok: false,
      message: safeDomainErrorMessage(
        cause,
        "販売パッケージを取り込めませんでした。",
      ),
    };
  }
}
