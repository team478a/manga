import {
  type CharacterProfile,
  type ProjectBundle,
} from "@mangai/project-core";
import {
  characterProfileInputSchema,
  characterReferenceAssetInputSchema,
} from "@mangai/shared";
import {
  adultReferenceImageAssessmentSchema,
  generationRouteDecisionRecordSchema,
  projectGenerationPolicySchema,
  type AdultReferenceImageAssessment,
  type GenerationRouteDecisionRecord,
  type ProjectGenerationPolicy,
} from "@mangai/ai-core";
import { panelLayerInputSchema } from "@mangai/canvas-core";

export const BACKUP_FORMAT = "mangai.project-backup";

export type ProjectBackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: 1 | 2;
  createdAt: string;
  bundle: ProjectBundle;
  history?: ProjectBackupHistory;
  generationPolicy?: ProjectGenerationPolicy;
  characterProfiles?: CharacterProfile[];
  adultReferenceImageAssessments?: Array<{
    assetId: string;
    assessment: AdultReferenceImageAssessment;
  }>;
};

export type BackupOperation = {
  label: string;
  beforeJson: string;
  afterJson: string;
  isUndone: number;
  createdAt: string;
};

export type BackupChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type BackupChatMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  providerId: string | null;
  modelId: string | null;
  createdAt: string;
};

export type BackupGenerationJob = {
  id: string;
  episodeId: string | null;
  pageId: string | null;
  providerType: string;
  providerId: string;
  modelId: string | null;
  generationType: string;
  status: string;
  progress: number;
  prompt: string;
  negativePrompt: string;
  inputJson: string;
  outputJson: string;
  providerJobId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type BackupGenerationOutput = {
  id: string;
  jobId: string;
  assetId: string | null;
  relativePath: string | null;
  metadataJson: string;
  createdAt: string;
};

export type ProjectBackupHistory = {
  operations: BackupOperation[];
  chatSessions: BackupChatSession[];
  chatMessages: BackupChatMessage[];
  generationJobs: BackupGenerationJob[];
  generationOutputs: BackupGenerationOutput[];
  routeDecisions?: GenerationRouteDecisionRecord[];
};

export const assetExtension = (mimeType: string) =>
  ({
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  })[mimeType] || "";

export function parseBackupManifest(value: unknown): ProjectBackupManifest {
  if (!value || typeof value !== "object")
    throw new Error("バックアップ情報が不正です。");
  const manifest = value as Record<string, unknown>;
  if (
    manifest.format !== BACKUP_FORMAT ||
    (manifest.version !== 1 && manifest.version !== 2)
  )
    throw new Error("対応していないバックアップ形式です。");
  const bundle = manifest.bundle as ProjectBundle | undefined;
  if (!bundle || !bundle.project || typeof bundle.project !== "object")
    throw new Error("Project情報がありません。");
  if (!Array.isArray(bundle.panelLayers)) bundle.panelLayers = [];
  const collections = [
    bundle.episodes,
    bundle.pages,
    bundle.panels,
    bundle.panelLayers,
    bundle.balloons,
    bundle.textObjects,
    bundle.assets,
  ];
  if (collections.some((items) => !Array.isArray(items)))
    throw new Error("バックアップのデータ構造が不正です。");
  if (
    typeof bundle.project.title !== "string" ||
    !bundle.project.title.trim() ||
    !Number.isFinite(bundle.project.width) ||
    !Number.isFinite(bundle.project.height) ||
    !Number.isFinite(bundle.project.dpi)
  )
    throw new Error("Project設定が不正です。");
  if (bundle.episodes.length < 1 || bundle.episodes.length > 1000)
    throw new Error("エピソード数が不正です。");
  if (bundle.pages.length > 10000 || bundle.assets.length > 10000)
    throw new Error("バックアップ内の項目数が上限を超えています。");
  if (bundle.panelLayers.length > 1_000_000)
    throw new Error("コマレイヤー数が上限を超えています。");
  for (const items of collections)
    for (const item of items)
      if (!item || typeof item.id !== "string" || !item.id)
        throw new Error("バックアップ内のIDが不正です。");
  for (const asset of bundle.assets)
    if (
      !assetExtension(asset.mimeType) ||
      !Number.isSafeInteger(asset.byteSize) ||
      asset.byteSize < 0 ||
      !/^[0-9a-f]{64}$/i.test(asset.sha256)
    )
      throw new Error(`素材「${asset.fileName}」の情報が不正です。`);
  const panelIds = new Set(bundle.panels.map((panel) => panel.id));
  const assetIds = new Set(bundle.assets.map((asset) => asset.id));
  for (const layer of bundle.panelLayers) {
    panelLayerInputSchema.parse(layer);
    if (!panelIds.has(layer.panelId))
      throw new Error("コマレイヤーのコマ参照が不正です。");
    if (layer.assetId && !assetIds.has(layer.assetId))
      throw new Error("コマレイヤーの素材参照が不正です。");
  }
  if (manifest.version === 2) {
    const history = manifest.history as ProjectBackupHistory | undefined;
    const historyCollections = history && [
      history.operations,
      history.chatSessions,
      history.chatMessages,
      history.generationJobs,
      history.generationOutputs,
    ];
    if (
      !historyCollections ||
      historyCollections.some((items) => !Array.isArray(items))
    )
      throw new Error("バックアップ履歴のデータ構造が不正です。");
    if (historyCollections.some((items) => items.length > 100_000))
      throw new Error("バックアップ履歴の項目数が上限を超えています。");
    if (history.routeDecisions !== undefined) {
      if (
        !Array.isArray(history.routeDecisions) ||
        history.routeDecisions.length > 100_000
      )
        throw new Error("Route判定履歴のデータ構造が不正です。");
      for (const item of history.routeDecisions)
        generationRouteDecisionRecordSchema.parse(item);
    }
  }
  if (manifest.generationPolicy !== undefined)
    projectGenerationPolicySchema.parse(manifest.generationPolicy);
  if (manifest.characterProfiles !== undefined) {
    if (
      !Array.isArray(manifest.characterProfiles) ||
      manifest.characterProfiles.length > 10_000
    )
      throw new Error("キャラクターProfileのデータ構造が不正です。");
    const backupAssetIds = new Set(bundle.assets.map((asset) => asset.id));
    for (const profile of manifest.characterProfiles as CharacterProfile[]) {
      characterProfileInputSchema.parse({
        ...profile,
        projectId: bundle.project.id,
      });
      if (!Array.isArray(profile.referenceAssets))
        throw new Error("キャラクター参照素材の構造が不正です。");
      for (const reference of profile.referenceAssets) {
        characterReferenceAssetInputSchema.parse({
          characterProfileId: profile.id,
          assetId: reference.assetId,
          role: reference.role,
        });
        if (!backupAssetIds.has(reference.assetId))
          throw new Error("キャラクター参照素材がProject内にありません。");
      }
    }
  }
  if (manifest.adultReferenceImageAssessments !== undefined) {
    if (
      !Array.isArray(manifest.adultReferenceImageAssessments) ||
      manifest.adultReferenceImageAssessments.length > 10_000
    )
      throw new Error("参照画像の安全確認データ構造が不正です。");
    const backupAssetIds = new Set(bundle.assets.map((asset) => asset.id));
    for (const item of manifest.adultReferenceImageAssessments as Array<{
      assetId: string;
      assessment: unknown;
    }>) {
      if (!backupAssetIds.has(item.assetId))
        throw new Error("参照画像の安全確認対象がProject内にありません。");
      adultReferenceImageAssessmentSchema.parse(item.assessment);
    }
  }
  return manifest as ProjectBackupManifest;
}
