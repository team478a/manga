import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMaskSuggestion,
  maskSuggestionsForPreset,
} from "../src/app/creator/[projectId]/pages/[pageId]/services/panel-mask-suggestions.ts";

test("修正内容ごとに適切なおすすめ範囲を先頭に返す", () => {
  assert.equal(defaultMaskSuggestion("face").id, "face");
  assert.equal(defaultMaskSuggestion("expression").id, "expression");
  assert.equal(defaultMaskSuggestion("hands").id, "both-hands");
  assert.equal(defaultMaskSuggestion("costume").id, "costume");
  assert.equal(defaultMaskSuggestion("background").id, "background");
  assert.equal(defaultMaskSuggestion("polish").id, "full");
});

test("手の修正では両手・左側・右側を選び直せる", () => {
  assert.deepEqual(
    maskSuggestionsForPreset("hands").map((suggestion) => suggestion.id),
    ["both-hands", "left-hand", "right-hand"],
  );
});

test("背景提案は中央を保持する外周4領域で構成する", () => {
  const suggestion = defaultMaskSuggestion("background");
  assert.equal(suggestion.shapes.length, 4);
  assert.ok(suggestion.shapes.every((shape) => shape.kind === "rectangle"));
});

test("すべての座標は画像内の正規化値である", () => {
  for (const preset of [
    "face",
    "hands",
    "expression",
    "costume",
    "background",
    "polish",
  ]) {
    for (const suggestion of maskSuggestionsForPreset(preset)) {
      for (const shape of suggestion.shapes) {
        for (const value of Object.values(shape).filter(
          (entry) => typeof entry === "number",
        )) {
          assert.ok(value >= 0 && value <= 1);
        }
      }
    }
  }
});
