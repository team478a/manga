import { z } from "zod";

export const idSchema = z.string().uuid();
export const ageRatingSchema = z.enum(["全年齢", "12歳以上", "15歳以上", "成人向け"]);
export const readingDirectionSchema = z.enum(["rtl", "ltr"]);
export const projectInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).default(""),
  description: z.string().trim().max(5000).default(""),
  genre: z.string().trim().max(100).default(""),
  ageRating: ageRatingSchema.default("全年齢"),
  readingDirection: readingDirectionSchema.default("rtl"),
  width: z.number().int().min(100).max(20000).default(1600),
  height: z.number().int().min(100).max(20000).default(2400),
  dpi: z.number().int().min(72).max(1200).default(300),
  storagePath: z.string().trim().optional()
});
export const renameProjectSchema = z.object({ id: idSchema, title: z.string().trim().min(1).max(200) });
export const projectIdSchema = z.object({ id: idSchema });
export const episodeInputSchema = z.object({ projectId: idSchema, title: z.string().trim().min(1).max(200) });
export const pageInputSchema = z.object({ episodeId: idSchema, imageAssetId: idSchema.optional() });
export const reorderPagesSchema = z.object({ episodeId: idSchema, pageIds: z.array(idSchema).min(1) });
export const importAssetsSchema = z.object({ projectId: idSchema, paths: z.array(z.string().min(1)).min(1).max(500) });
export const assetIdSchema = z.object({ id: idSchema });
export const pagePromptSchema = z.object({ id: idSchema, prompt: z.string().max(10000), negativePrompt: z.string().max(10000), notes: z.string().max(10000) });

export type ProjectInput = z.infer<typeof projectInputSchema>;

