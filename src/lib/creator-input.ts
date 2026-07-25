import { z } from "zod";

export const CREATOR_INPUT_LIMITS = {
  displayName: 80,
  bio: 1_000,
  workTitle: 120,
  workDescription: 5_000,
  tagCount: 10,
  tagLength: 30,
} as const;

export const profileInputSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "表示名を入力してください。")
    .max(
      CREATOR_INPUT_LIMITS.displayName,
      `表示名は${CREATOR_INPUT_LIMITS.displayName}文字以内にしてください。`,
    ),
  bio: z
    .string()
    .trim()
    .max(
      CREATOR_INPUT_LIMITS.bio,
      `自己紹介は${CREATOR_INPUT_LIMITS.bio}文字以内にしてください。`,
    ),
});

export const workInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "作品名を入力してください。")
    .max(
      CREATOR_INPUT_LIMITS.workTitle,
      `作品名は${CREATOR_INPUT_LIMITS.workTitle}文字以内にしてください。`,
    ),
  description: z
    .string()
    .trim()
    .max(
      CREATOR_INPUT_LIMITS.workDescription,
      `作品説明は${CREATOR_INPUT_LIMITS.workDescription}文字以内にしてください。`,
    ),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(
          CREATOR_INPUT_LIMITS.tagLength,
          `タグは1件${CREATOR_INPUT_LIMITS.tagLength}文字以内にしてください。`,
        ),
    )
    .max(
      CREATOR_INPUT_LIMITS.tagCount,
      `タグは${CREATOR_INPUT_LIMITS.tagCount}件以内にしてください。`,
    ),
  visibility: z.enum(["private", "public"]),
});

export function normalizeCreatorTags(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return [];
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ];
}

export function firstValidationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "入力内容を確認してください。";
}

