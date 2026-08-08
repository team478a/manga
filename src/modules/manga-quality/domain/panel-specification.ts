import { z } from "zod";
import { characterIdentitySchema } from "./character-identity.ts";

export const panelSpecificationSchema = z.object({
  version: z.literal(1),
  panelId: z.string().uuid(),
  characterNames: z.array(z.string().trim().min(1).max(100)).max(12),
  characterIdentities: z.array(characterIdentitySchema).max(12).default([]),
  expectedCharacterCount: z.number().int().min(0).max(12),
  expression: z.string().trim().max(500),
  composition: z.string().trim().min(1).max(1000),
  background: z.string().trim().max(1000),
  props: z.array(z.string().trim().min(1).max(200)).max(12),
  action: z.string().trim().max(1000),
  shot: z.string().trim().min(1).max(100),
  cameraAngle: z.string().trim().min(1).max(100),
  generationTarget: z.enum(["composite", "background", "character", "effect"]),
});

export type PanelSpecification = z.infer<typeof panelSpecificationSchema>;
