import { z } from "zod";

export const cloudStyleBibleInputSchema = z.object({
  projectId: z.string().uuid(),
  artStyle: z.string().trim().max(500),
  linework: z.string().trim().max(500),
  shading: z.string().trim().max(500),
  backgroundDetail: z.string().trim().max(500),
  compositionRules: z.string().trim().max(1000),
  negativePrompt: z.string().trim().max(1500),
});

export const cloudWorldProfileInputSchema = z.object({
  projectId: z.string().uuid(),
  profileId: z.string().uuid().nullable(),
  kind: z.enum(["location", "prop"]),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  visualTraits: z.array(z.string().trim().min(1).max(120)).max(12),
  colorPalette: z.string().trim().max(300),
  continuityRules: z.array(z.string().trim().min(1).max(120)).max(12),
  prompt: z.string().trim().max(3000),
  negativePrompt: z.string().trim().max(1500),
});

export type CloudStyleBibleInput = z.infer<typeof cloudStyleBibleInputSchema>;
export type CloudWorldProfileInput = z.infer<typeof cloudWorldProfileInputSchema>;

export type CloudStyleBible = {
  id: string;
  project_id: string;
  current_version: number;
  art_style: string;
  linework: string;
  shading: string;
  background_detail: string;
  composition_rules: string;
  negative_prompt: string;
  updated_at: string;
};

export type CloudWorldProfile = {
  id: string;
  project_id: string;
  kind: CloudWorldProfileInput["kind"];
  name: string;
  current_version: number;
  description: string;
  visual_traits: string[];
  color_palette: string;
  continuity_rules: string[];
  prompt: string;
  negative_prompt: string;
  updated_at: string;
};

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase();

export function resolveWorldProfilesForPanel(
  profiles: CloudWorldProfile[],
  panel: { background: string; action: string; composition: string },
) {
  const context = normalize(`${panel.background}\n${panel.action}\n${panel.composition}`);
  return profiles.filter((profile) => context.includes(normalize(profile.name)));
}
