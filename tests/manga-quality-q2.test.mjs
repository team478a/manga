import assert from "node:assert/strict";
import test from "node:test";
import { attachCharacterIdentities } from "../src/modules/manga-quality/application/attach-character-identities.ts";
import {
  registerCharacterIdentity,
  updateCharacterIdentity,
} from "../src/modules/manga-quality/application/manage-character-identity.ts";
import { evaluatePanelCandidate } from "../src/modules/manga-quality/application/rule-based-panel-judge.ts";
import { characterIdentitySchema } from "../src/modules/manga-quality/domain/character-identity.ts";
import { evaluateCharacterConsistency } from "../src/modules/manga-quality/domain/character-consistency.ts";
import { panelSpecificationSchema } from "../src/modules/manga-quality/domain/panel-specification.ts";

const characterId = "70000000-0000-4000-8000-000000000021";
const assetId = "74000000-0000-4000-8000-000000000021";
const identity = registerCharacterIdentity({
  id: characterId,
  name: "明日香",
  appearanceAge: "20代前半",
  bodyBuild: "小柄",
  hair: "黒髪のショートボブ",
  costume: "白いシャツと紺のジャケット",
  immutableTraits: ["左目の下のほくろ"],
  referenceAssetIds: [assetId, assetId],
});

const specification = panelSpecificationSchema.parse({
  version: 1,
  panelId: "00000000-0000-4000-8000-000000000021",
  characterNames: ["明日香"],
  expectedCharacterCount: 1,
  expression: "驚き",
  composition: "人物を中景で捉える",
  background: "駅のホーム",
  props: [],
  action: "振り返る",
  shot: "medium",
  cameraAngle: "eye_level",
  generationTarget: "composite",
});

test("existing profile and private asset IDs form a storable Character Identity", () => {
  const restored = characterIdentitySchema.parse(JSON.parse(JSON.stringify(identity)));
  assert.equal(restored.displayName, "明日香");
  assert.deepEqual(restored.identityReferenceImages, [assetId]);
  assert.deepEqual(restored.expressionReferenceImages, []);
  assert.deepEqual(restored.fullBodyReferenceImages, []);
});

test("derived and explicitly updated locked attributes survive validation", () => {
  assert.deepEqual(identity.lockedAttributes, [
    "ageRange",
    "bodyType",
    "hairStyle",
    "defaultOutfit",
    "distinguishingFeatures",
  ]);
  const updated = updateCharacterIdentity(identity, {
    hairColor: "黒",
    eyeColor: "茶",
    lockedAttributes: [...identity.lockedAttributes, "hairColor", "eyeColor"],
  });
  assert.equal(updated.hairColor, "黒");
  assert.ok(updated.lockedAttributes.includes("eyeColor"));
});

test("Character Identity attaches to Panel Specification without changing Canvas", () => {
  const attached = attachCharacterIdentities(specification, [identity, identity]);
  assert.equal(attached.characterIdentities.length, 1);
  assert.equal(attached.characterIdentities[0].characterId, characterId);
  assert.equal(specification.characterIdentities.length, 0);
});

test("consistency scoring is neutral without observations and deducts mismatches", () => {
  const neutral = evaluateCharacterConsistency([identity], []);
  assert.equal(neutral.overallScore, 75);
  assert.equal(neutral.semanticEvidenceAvailable, false);

  const evaluated = evaluateCharacterConsistency([identity], [{
    characterId,
    attributeScores: { hairStyle: 100, defaultOutfit: 20 },
  }]);
  assert.equal(evaluated.overallScore, 60);
  assert.deepEqual(evaluated.characters[0].mismatchedAttributes, ["defaultOutfit"]);
});

test("Judge uses locked-attribute evidence and records consistency failures", () => {
  const attached = attachCharacterIdentities(specification, [identity]);
  const evaluation = evaluatePanelCandidate(attached, {
    assetAvailable: true,
    characterIdentityEvidence: [{
      characterId,
      attributeScores: { hairStyle: 25, defaultOutfit: 90 },
    }],
  });
  assert.equal(evaluation.scores.characterMatchScore, 57.5);
  assert.ok(evaluation.failureCategories.includes("face_mismatch"));
  assert.ok(evaluation.failureCategories.includes("continuity_break"));
  assert.equal(evaluation.evidence.semanticEvidenceAvailable, true);
});
