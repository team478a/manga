export type Project = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  genre: string;
  ageRating: "全年齢" | "12歳以上" | "15歳以上" | "成人向け";
  contentClass: "general" | "adult";
  readingDirection: "rtl" | "ltr";
  width: number;
  height: number;
  dpi: number;
  storagePath: string;
  coverAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string | null;
};
export type Episode = {
  id: string;
  projectId: string;
  title: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};
export type Page = {
  id: string;
  episodeId: string;
  pageNumber: number;
  orderIndex: number;
  width: number;
  height: number;
  backgroundColor: string;
  imageAssetId: string | null;
  prompt: string;
  negativePrompt: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type Panel = {
  id: string;
  pageId: string;
  name: string;
  orderIndex: number;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  shape: "rectangle" | "slant_up" | "slant_down" | "curve_left" | "curve_right";
  slant: number;
  imageAssetId: string | null;
  imageFit: "cover" | "contain" | "manual";
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotation: number;
  imageOpacity: number;
  prompt: string;
  negativePrompt: string;
  generationStatus: string;
  metadata: string;
  createdAt: string;
  updatedAt: string;
};
export type PanelLayerType =
  | "background"
  | "character"
  | "prop"
  | "effect"
  | "tone"
  | "mask"
  | "correction"
  | "flattened_legacy";
export type PanelLayerBlendMode = "normal" | "multiply" | "screen" | "overlay";
export type PanelLayer = {
  id: string;
  panelId: string;
  name: string;
  type: PanelLayerType;
  orderIndex: number;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: PanelLayerBlendMode;
  assetId: string | null;
  sourceJobId: string | null;
  imageFit: "cover" | "contain" | "manual";
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageRotation: number;
  createdAt: string;
  updatedAt: string;
};
export type Balloon = {
  id: string;
  pageId: string;
  name: string;
  type: "speech_ellipse" | "speech_rounded" | "narration_box";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  visible: boolean;
  locked: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  opacity: number;
  tailDirection:
    | "none"
    | "top"
    | "top_right"
    | "right"
    | "bottom_right"
    | "bottom"
    | "bottom_left"
    | "left"
    | "top_left";
  tailOffset: number;
  createdAt: string;
  updatedAt: string;
};
export type TextObject = {
  id: string;
  pageId: string;
  parentBalloonId: string | null;
  name: string;
  text: string;
  writingMode: "horizontal" | "vertical";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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
export type Asset = {
  id: string;
  projectId: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  width: number;
  height: number;
  byteSize: number;
  sha256: string;
  libraryCategory:
    "unclassified" | "background" | "prop" | "effect" | "character" | "other";
  libraryTags: string[];
  libraryFavorite: boolean;
  libraryUpdatedAt: string | null;
  createdAt: string;
};
export type CharacterReferenceRole = "reference" | "face" | "pose";
export type CharacterReferenceAsset = {
  assetId: string;
  role: CharacterReferenceRole;
  orderIndex: number;
};
export type CharacterProfile = {
  id: string;
  projectId: string;
  name: string;
  description: string;
  prompt: string;
  negativePrompt: string;
  referenceAssets: CharacterReferenceAsset[];
  createdAt: string;
  updatedAt: string;
};
export const INTERNAL_PANEL_CACHE_TAG_PREFIX = "mangai:internal:panel-cache:";
export function isInternalPanelCacheAsset(asset: Pick<Asset, "libraryTags">) {
  return asset.libraryTags.some((tag) =>
    tag.startsWith(INTERNAL_PANEL_CACHE_TAG_PREFIX),
  );
}
export type ProjectBundle = {
  project: Project;
  episodes: Episode[];
  pages: Page[];
  panels: Panel[];
  panelLayers: PanelLayer[];
  balloons: Balloon[];
  textObjects: TextObject[];
  assets: Asset[];
};

export function ordered<T extends { orderIndex: number }>(items: T[]) {
  return [...items].sort((a, b) => a.orderIndex - b.orderIndex);
}
export function nextOrderIndex<T extends { orderIndex: number }>(items: T[]) {
  return items.length ? Math.max(...items.map((x) => x.orderIndex)) + 1 : 0;
}
