import { z } from "zod";

export const idSchema = z.string().uuid();
export const ageRatingSchema = z.enum([
  "全年齢",
  "12歳以上",
  "15歳以上",
  "成人向け",
]);
export const contentClassSchema = z.enum(["general", "adult"]);
export const productSurfaceSchema = z.enum(["cloud", "desktop"]);
export const executionTargetSchema = z.enum([
  "cloud_provider",
  "local",
  "external_byok",
]);
export const CONTENT_POLICY_VERSION = 1 as const;
export const contentExecutionPolicySchema = z
  .object({
    version: z.literal(CONTENT_POLICY_VERSION).default(CONTENT_POLICY_VERSION),
    contentClass: contentClassSchema,
    productSurface: productSurfaceSchema,
    allowedTargets: z.array(executionTargetSchema).min(1),
    externalConfirmationRequired: z.boolean(),
  })
  .superRefine((policy, context) => {
    if (policy.contentClass === "adult" && policy.productSurface === "cloud")
      context.addIssue({
        code: "custom",
        message: "成人向けコンテンツはMANGAI Cloudで処理できません。",
        path: ["contentClass"],
      });
    if (
      policy.contentClass === "adult" &&
      policy.allowedTargets.includes("cloud_provider")
    )
      context.addIssue({
        code: "custom",
        message: "成人向けコンテンツを一般向けCloud Providerへ送信できません。",
        path: ["allowedTargets"],
      });
    if (
      policy.allowedTargets.includes("external_byok") &&
      !policy.externalConfirmationRequired
    )
      context.addIssue({
        code: "custom",
        message: "外部BYOK Providerは送信前確認が必須です。",
        path: ["externalConfirmationRequired"],
      });
  });
export const readingDirectionSchema = z.enum(["rtl", "ltr"]);
export const projectInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  genre: z.string().trim().max(100).default(""),
  ageRating: ageRatingSchema.default("全年齢"),
  contentClass: contentClassSchema.optional(),
  readingDirection: readingDirectionSchema.default("rtl"),
  width: z.number().int().min(100).max(20000).default(1600),
  height: z.number().int().min(100).max(20000).default(2400),
  dpi: z.number().int().min(72).max(1200).default(300),
  storagePath: z.string().trim().optional(),
  adultProjectAcknowledged: z.boolean().default(false),
});
export const renameProjectSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
});
export const characterReferenceRoleSchema = z.enum([
  "reference",
  "face",
  "pose",
]);
export const characterProfileInputSchema = z.object({
  id: idSchema.optional(),
  projectId: idSchema,
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  prompt: z.string().trim().max(50000).default(""),
  negativePrompt: z.string().trim().max(50000).default(""),
});
export const characterProfileIdSchema = z.object({ id: idSchema });
export const characterReferenceAssetInputSchema = z.object({
  characterProfileId: idSchema,
  assetId: idSchema,
  role: characterReferenceRoleSchema.default("reference"),
});
export const projectContentClassChangeSchema = z.object({
  id: idSchema,
  contentClass: contentClassSchema,
});
export const cloudAssetMimeTypeSchema = z.enum([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const cloudImportEpisodeSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
  orderIndex: z.number().int().min(0),
});
const cloudImportPageSchema = z.object({
  id: idSchema,
  episodeId: idSchema,
  pageNumber: z.number().int().min(1),
  orderIndex: z.number().int().min(0),
  width: z.number().int().min(100).max(20000),
  height: z.number().int().min(100).max(20000),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
const cloudImportAssetSchema = z.object({
  id: idSchema,
  fileName: z.string().trim().min(1).max(255),
  mimeType: cloudAssetMimeTypeSchema,
  byteSize: z
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
  width: z.number().int().min(1).max(20000),
  height: z.number().int().min(1).max(20000),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
const cloudImportSnapshotSchema = z.object({
  pageId: idSchema,
  canvas: z.record(z.string(), z.unknown()),
});
export const cloudProjectImportSchema = z
  .object({
    format: z.literal("mangai.cloud-project"),
    version: z.literal(1),
    policyVersion: z.literal(CONTENT_POLICY_VERSION),
    createdBySurface: z.literal("desktop"),
    project: z.object({
      sourceProjectId: idSchema,
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(5000).default(""),
      contentClass: z.literal("general"),
      ageRating: z.enum(["全年齢", "12歳以上", "15歳以上"]),
      readingDirection: readingDirectionSchema,
      width: z.number().int().min(100).max(20000),
      height: z.number().int().min(100).max(20000),
      dpi: z.number().int().min(72).max(1200),
    }),
    episodes: z.array(cloudImportEpisodeSchema).max(1000),
    pages: z.array(cloudImportPageSchema).max(10000),
    assets: z.array(cloudImportAssetSchema).max(10000).default([]),
    snapshots: z.array(cloudImportSnapshotSchema).max(10000).default([]),
  })
  .superRefine((manifest, context) => {
    const episodeIds = new Set(manifest.episodes.map((item) => item.id));
    const pageIds = new Set(manifest.pages.map((item) => item.id));
    const assetIds = new Set(manifest.assets.map((item) => item.id));
    if (episodeIds.size !== manifest.episodes.length)
      context.addIssue({
        code: "custom",
        message: "Episode IDが重複しています。",
      });
    if (pageIds.size !== manifest.pages.length)
      context.addIssue({
        code: "custom",
        message: "Page IDが重複しています。",
      });
    if (assetIds.size !== manifest.assets.length)
      context.addIssue({
        code: "custom",
        message: "Asset IDが重複しています。",
      });
    manifest.pages.forEach((page, index) => {
      if (!episodeIds.has(page.episodeId))
        context.addIssue({
          code: "custom",
          message: "Pageが存在しないEpisodeを参照しています。",
          path: ["pages", index, "episodeId"],
        });
    });
    const snapshotPageIds = new Set<string>();
    manifest.snapshots.forEach((snapshot, index) => {
      if (!pageIds.has(snapshot.pageId))
        context.addIssue({
          code: "custom",
          message: "Canvasが存在しないPageを参照しています。",
          path: ["snapshots", index, "pageId"],
        });
      if (snapshotPageIds.has(snapshot.pageId))
        context.addIssue({
          code: "custom",
          message: "同じPageのCanvasが重複しています。",
          path: ["snapshots", index, "pageId"],
        });
      snapshotPageIds.add(snapshot.pageId);
    });
  });
export const projectIdSchema = z.object({ id: idSchema });
export const hubStatusRequestSchema = z.object({
  projectId: idSchema,
  baseUrl: z.string().trim().url().max(2048),
});
export const episodeInputSchema = z.object({
  projectId: idSchema,
  title: z.string().trim().min(1).max(200),
});
export const renameEpisodeSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(200),
});
export const reorderEpisodesSchema = z.object({
  projectId: idSchema,
  episodeIds: z.array(idSchema).min(1),
});
export const setProjectCoverSchema = z.object({
  projectId: idSchema,
  assetId: idSchema,
});
export const pageInputSchema = z.object({
  episodeId: idSchema,
  imageAssetId: idSchema.optional(),
});
export const reorderPagesSchema = z.object({
  episodeId: idSchema,
  pageIds: z.array(idSchema).min(1),
});
export const importAssetsSchema = z.object({
  projectId: idSchema,
  paths: z.array(z.string().min(1)).min(1).max(500),
});
export const assetIdSchema = z.object({ id: idSchema });
export const assetLibraryCategorySchema = z.enum([
  "unclassified",
  "background",
  "prop",
  "effect",
  "character",
  "other",
]);
export const assetLibraryMetadataInputSchema = z.object({
  assetId: idSchema,
  category: assetLibraryCategorySchema,
  tags: z
    .array(z.string().trim().min(1).max(50))
    .max(20)
    .transform((tags) => [...new Set(tags)]),
  favorite: z.boolean(),
});
export const pagePromptSchema = z.object({
  id: idSchema,
  prompt: z.string().max(10000),
  negativePrompt: z.string().max(10000),
  notes: z.string().max(10000),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;
export type ContentClass = z.infer<typeof contentClassSchema>;
export type ProductSurface = z.infer<typeof productSurfaceSchema>;
export type ExecutionTarget = z.infer<typeof executionTargetSchema>;
export type ContentExecutionPolicy = z.infer<
  typeof contentExecutionPolicySchema
>;
export type CloudProjectImport = z.infer<typeof cloudProjectImportSchema>;
export type HubStatusRequest = z.infer<typeof hubStatusRequestSchema>;
export type AssetLibraryCategory = z.infer<typeof assetLibraryCategorySchema>;
export type AssetLibraryMetadataInput = z.infer<
  typeof assetLibraryMetadataInputSchema
>;

export function contentClassFromAgeRating(value: unknown): ContentClass {
  if (value === "全年齢" || value === "12歳以上" || value === "15歳以上")
    return "general";
  return "adult";
}

export function resolveProjectContentClass(input: {
  ageRating: unknown;
  contentClass?: unknown;
}): ContentClass {
  const inferred = contentClassFromAgeRating(input.ageRating);
  if (input.contentClass === undefined || input.contentClass === null)
    return inferred;
  const explicit = contentClassSchema.parse(input.contentClass);
  if (explicit !== inferred)
    throw new Error("作品区分と対象年齢が一致していません。");
  return explicit;
}

export function assertGeneralCloudContent(input: {
  contentClass?: unknown;
  ageRating?: unknown;
}): "general" {
  const contentClass = input.contentClass
    ? contentClassSchema.parse(input.contentClass)
    : contentClassFromAgeRating(input.ageRating);
  if (contentClass !== "general")
    throw new Error(
      "成人向け作品はMANGAI Cloudへ保存・送信できません。MANGAI Desktop Adultを使用してください。",
    );
  return contentClass;
}
