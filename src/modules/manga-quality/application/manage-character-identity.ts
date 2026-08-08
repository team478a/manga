import {
  characterIdentitySchema,
  type CharacterIdentity,
} from "../domain/character-identity.ts";
import {
  uniqueIdentityLocks,
  type IdentityLock,
} from "../domain/identity-lock.ts";

export type ExistingCharacterIdentitySource = {
  id: string;
  name: string;
  appearanceAge: string;
  bodyBuild: string;
  hair: string;
  costume: string;
  immutableTraits: string[];
  referenceAssetIds: string[];
};

function locksForSource(source: ExistingCharacterIdentitySource) {
  return uniqueIdentityLocks([
    ...(source.appearanceAge ? ["ageRange" as const] : []),
    ...(source.bodyBuild ? ["bodyType" as const] : []),
    ...(source.hair ? ["hairStyle" as const] : []),
    ...(source.costume ? ["defaultOutfit" as const] : []),
    ...(source.immutableTraits.length
      ? ["distinguishingFeatures" as const]
      : []),
  ]);
}

export function registerCharacterIdentity(
  source: ExistingCharacterIdentitySource,
): CharacterIdentity {
  return characterIdentitySchema.parse({
    version: 1,
    characterId: source.id,
    displayName: source.name,
    ageRange: source.appearanceAge,
    bodyType: source.bodyBuild,
    heightClass: "",
    faceSummary: "",
    hairStyle: source.hair,
    hairColor: "",
    eyeColor: "",
    skinTone: "",
    defaultOutfit: source.costume,
    alternateOutfits: [],
    distinguishingFeatures: source.immutableTraits,
    identityReferenceImages: [...new Set(source.referenceAssetIds)].slice(0, 24),
    expressionReferenceImages: [],
    fullBodyReferenceImages: [],
    lockedAttributes: locksForSource(source),
  });
}

export function updateCharacterIdentity(
  identity: CharacterIdentity,
  patch: Partial<Omit<CharacterIdentity, "version" | "characterId">> & {
    lockedAttributes?: IdentityLock[];
  },
) {
  return characterIdentitySchema.parse({
    ...identity,
    ...patch,
    lockedAttributes: patch.lockedAttributes
      ? uniqueIdentityLocks(patch.lockedAttributes)
      : identity.lockedAttributes,
  });
}
