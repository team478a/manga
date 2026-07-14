export type CanvasObjectType = "panel" | "balloon" | "text";
export type ImageFit = "cover" | "contain" | "manual";
export type PanelShape = "rectangle" | "slant_up" | "slant_down";
export type BalloonType = "speech_ellipse" | "speech_rounded" | "narration_box";
export type TailDirection =
  | "none"
  | "top"
  | "top_right"
  | "right"
  | "bottom_right"
  | "bottom"
  | "bottom_left"
  | "left"
  | "top_left";
export type WritingMode = "horizontal" | "vertical";
export type PageSize = { width: number; height: number };
export type Point = { x: number; y: number };
export type Rect = Point & { width: number; height: number };
export type TransformRect = Rect & { rotation: number };
export type Panel = TransformRect & {
  id: string;
  pageId: string;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  shape: PanelShape;
  slant: number;
  imageAssetId: string | null;
  imageFit: ImageFit;
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotation: number;
  imageOpacity: number;
  createdAt: string;
  updatedAt: string;
};
export type Balloon = TransformRect & {
  id: string;
  pageId: string;
  name: string;
  type: BalloonType;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  tailDirection: TailDirection;
  tailOffset: number;
  createdAt: string;
  updatedAt: string;
};
export type TextObject = TransformRect & {
  id: string;
  pageId: string;
  parentBalloonId: string | null;
  name: string;
  text: string;
  writingMode: WritingMode;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign: "start" | "center" | "end";
  verticalAlign: "top" | "middle" | "bottom";
  lineHeight: number;
  letterSpacing: number;
  padding: number;
  opacity: number;
  createdAt: string;
  updatedAt: string;
};
export type CanvasLayer = {
  id: string;
  type: CanvasObjectType;
  name: string;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  parentId?: string | null;
};
export type PageCanvas = {
  schemaVersion: 1;
  pageId: string;
  width: number;
  height: number;
  backgroundColor: string;
  panels: Panel[];
  balloons: Balloon[];
  textObjects: TextObject[];
};
