import { z } from "zod";

export const cloudCharacterProfileInputSchema = z.object({
  projectId: z.string().uuid(),
  profileId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["protagonist", "supporting", "antagonist", "other"]),
  appearanceAge: z.string().trim().min(1).max(120),
  bodyBuild: z.string().trim().min(1).max(300),
  hair: z.string().trim().min(1).max(300),
  costume: z.string().trim().min(1).max(500),
  colorPalette: z.string().trim().max(300),
  immutableTraits: z.array(z.string().trim().min(1).max(120)).min(1).max(12),
  prompt: z.string().trim().max(3000),
  negativePrompt: z.string().trim().max(1500),
});

export type CloudCharacterProfileInput = z.infer<typeof cloudCharacterProfileInputSchema>;

export type CloudCharacterProfile = {
  id: string;
  project_id: string;
  name: string;
  role: CloudCharacterProfileInput["role"];
  current_version: number;
  appearance_age: string;
  body_build: string;
  hair: string;
  costume: string;
  color_palette: string;
  immutable_traits: string[];
  prompt: string;
  negative_prompt: string;
  updated_at: string;
};

export function getMissingCloudCharacterVisualFields(
  profile: Pick<
    CloudCharacterProfile,
    "appearance_age" | "body_build" | "hair" | "costume" | "immutable_traits"
  > | null,
) {
  if (!profile)
    return ["見た目の年齢", "体格", "髪型・髪色", "基本衣装", "変えてはいけない特徴"];
  return [
    profile.appearance_age.trim() ? null : "見た目の年齢",
    profile.body_build.trim() ? null : "体格",
    profile.hair.trim() ? null : "髪型・髪色",
    profile.costume.trim() ? null : "基本衣装",
    profile.immutable_traits.length ? null : "変えてはいけない特徴",
  ].filter((value): value is string => value !== null);
}
