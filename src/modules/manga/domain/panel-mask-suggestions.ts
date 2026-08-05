export type MaskRevisionPreset =
  "face" | "hands" | "expression" | "costume" | "background" | "polish";

export type MaskSuggestionShape =
  | {
      kind: "ellipse";
      centerX: number;
      centerY: number;
      radiusX: number;
      radiusY: number;
    }
  | { kind: "rectangle"; x: number; y: number; width: number; height: number };

export type MaskSuggestion = {
  id: string;
  label: string;
  description: string;
  shapes: MaskSuggestionShape[];
};

const face: MaskSuggestion = {
  id: "face",
  label: "顔まわり",
  description: "画面中央上部の顔を想定した範囲",
  shapes: [
    {
      kind: "ellipse",
      centerX: 0.5,
      centerY: 0.31,
      radiusX: 0.19,
      radiusY: 0.22,
    },
  ],
};

const expression: MaskSuggestion = {
  id: "expression",
  label: "表情",
  description: "目・鼻・口を含む顔の内側を想定した範囲",
  shapes: [
    {
      kind: "ellipse",
      centerX: 0.5,
      centerY: 0.31,
      radiusX: 0.15,
      radiusY: 0.16,
    },
  ],
};

const leftHand: MaskSuggestion = {
  id: "left-hand",
  label: "左側の手",
  description: "画面左下寄りの手を想定した範囲",
  shapes: [
    {
      kind: "ellipse",
      centerX: 0.3,
      centerY: 0.64,
      radiusX: 0.15,
      radiusY: 0.17,
    },
  ],
};

const rightHand: MaskSuggestion = {
  id: "right-hand",
  label: "右側の手",
  description: "画面右下寄りの手を想定した範囲",
  shapes: [
    {
      kind: "ellipse",
      centerX: 0.7,
      centerY: 0.64,
      radiusX: 0.15,
      radiusY: 0.17,
    },
  ],
};

const bothHands: MaskSuggestion = {
  id: "both-hands",
  label: "両手",
  description: "画面左右の手を想定した2か所",
  shapes: [...leftHand.shapes, ...rightHand.shapes],
};

const costume: MaskSuggestion = {
  id: "costume",
  label: "衣装・上半身",
  description: "中央の首下から腰までを想定した範囲",
  shapes: [{ kind: "rectangle", x: 0.29, y: 0.45, width: 0.42, height: 0.4 }],
};

const background: MaskSuggestion = {
  id: "background",
  label: "背景",
  description: "中央の人物を避けた外周の範囲",
  shapes: [
    { kind: "rectangle", x: 0, y: 0, width: 1, height: 0.2 },
    { kind: "rectangle", x: 0, y: 0.8, width: 1, height: 0.2 },
    { kind: "rectangle", x: 0, y: 0.2, width: 0.22, height: 0.6 },
    { kind: "rectangle", x: 0.78, y: 0.2, width: 0.22, height: 0.6 },
  ],
};

const full: MaskSuggestion = {
  id: "full",
  label: "画像全体",
  description: "画像全体を修正する範囲",
  shapes: [{ kind: "rectangle", x: 0, y: 0, width: 1, height: 1 }],
};

const suggestionsByPreset: Record<MaskRevisionPreset, MaskSuggestion[]> = {
  face: [face, expression],
  expression: [expression, face],
  hands: [bothHands, leftHand, rightHand],
  costume: [costume, face],
  background: [background, full],
  polish: [full, face, background],
};

export function maskSuggestionsForPreset(preset: MaskRevisionPreset) {
  return suggestionsByPreset[preset];
}

export function defaultMaskSuggestion(preset: MaskRevisionPreset) {
  return maskSuggestionsForPreset(preset)[0];
}
