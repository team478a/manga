import { z } from "zod";

export const cloudCharacterProfileInputSchema = z.object({
  projectId: z.string().uuid(),
  profileId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(100),
  role: z.enum(["protagonist", "supporting", "antagonist", "other"]),
  appearanceAge: z.string().trim().max(120),
  bodyBuild: z.string().trim().max(300),
  hair: z.string().trim().max(300),
  costume: z.string().trim().max(500),
  colorPalette: z.string().trim().max(300),
  immutableTraits: z.array(z.string().trim().min(1).max(120)).max(12),
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
