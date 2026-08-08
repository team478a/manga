import { z } from "zod";
import type { CharacterIdentity } from "./character-identity.ts";
import {
  identityLockSchema,
  type IdentityLock,
} from "./identity-lock.ts";

export const characterIdentityEvidenceSchema = z.object({
  characterId: z.string().uuid(),
  attributeScores: z.partialRecord(
    identityLockSchema,
    z.number().min(0).max(100),
  ),
});

export type CharacterIdentityEvidence = z.infer<
  typeof characterIdentityEvidenceSchema
>;

export type CharacterConsistencyResult = {
  overallScore: number;
  semanticEvidenceAvailable: boolean;
  characters: Array<{
    characterId: string;
    score: number;
    evaluatedAttributes: IdentityLock[];
    mismatchedAttributes: IdentityLock[];
  }>;
};

const NEUTRAL_SCORE = 75;
const MISMATCH_THRESHOLD = 60;
const round = (value: number) => Math.round(value * 100) / 100;

export function evaluateCharacterConsistency(
  identities: readonly CharacterIdentity[],
  evidence: readonly CharacterIdentityEvidence[],
): CharacterConsistencyResult {
  const evidenceByCharacter = new Map(
    evidence.map((item) => [item.characterId, item]),
  );
  const characters = identities.map((identity) => {
    const observed = evidenceByCharacter.get(identity.characterId);
    const evaluatedAttributes = identity.lockedAttributes.filter(
      (attribute) => observed?.attributeScores[attribute] !== undefined,
    );
    const values = evaluatedAttributes.map(
      (attribute) => observed?.attributeScores[attribute] ?? NEUTRAL_SCORE,
    );
    return {
      characterId: identity.characterId,
      score: values.length
        ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
        : NEUTRAL_SCORE,
      evaluatedAttributes,
      mismatchedAttributes: evaluatedAttributes.filter(
        (attribute) =>
          (observed?.attributeScores[attribute] ?? NEUTRAL_SCORE) <
          MISMATCH_THRESHOLD,
      ),
    };
  });
  const evaluated = characters.filter(
    (character) => character.evaluatedAttributes.length > 0,
  );
  return {
    overallScore: evaluated.length
      ? round(
          evaluated.reduce((sum, character) => sum + character.score, 0) /
            evaluated.length,
        )
      : NEUTRAL_SCORE,
    semanticEvidenceAvailable: evaluated.length > 0,
    characters,
  };
}
