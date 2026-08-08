import { z } from "zod";
import { identityLockSchema } from "./identity-lock.ts";

const text = (max: number) => z.string().trim().max(max);
const textList = (maxItems: number, maxLength: number) =>
  z.array(z.string().trim().min(1).max(maxLength)).max(maxItems);
const assetIdList = z.array(z.string().uuid()).max(24);

export const characterIdentitySchema = z.object({
  version: z.literal(1),
  characterId: z.string().uuid(),
  displayName: z.string().trim().min(1).max(100),
  ageRange: text(120),
  bodyType: text(300),
  heightClass: text(120),
  faceSummary: text(500),
  hairStyle: text(300),
  hairColor: text(120),
  eyeColor: text(120),
  skinTone: text(120),
  defaultOutfit: text(500),
  alternateOutfits: textList(12, 500),
  distinguishingFeatures: textList(24, 200),
  identityReferenceImages: assetIdList,
  expressionReferenceImages: assetIdList,
  fullBodyReferenceImages: assetIdList,
  lockedAttributes: z.array(identityLockSchema).max(13),
});

export type CharacterIdentity = z.infer<typeof characterIdentitySchema>;
