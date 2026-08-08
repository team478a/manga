import { z } from "zod";

export const identityLockSchema = z.enum([
  "ageRange",
  "bodyType",
  "heightClass",
  "faceSummary",
  "hairStyle",
  "hairColor",
  "eyeColor",
  "skinTone",
  "defaultOutfit",
  "uniformType",
  "genderExpression",
  "possessions",
  "distinguishingFeatures",
]);

export type IdentityLock = z.infer<typeof identityLockSchema>;

export function uniqueIdentityLocks(values: readonly IdentityLock[]) {
  return [...new Set(values)];
}
