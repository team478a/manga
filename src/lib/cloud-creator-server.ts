import crypto from "node:crypto";
import { pageCanvasSchema, type PageCanvas } from "@mangai/canvas-core";
import {
  cloudGenerationInputSchema,
  moderateGeneralCloudPrompt,
  type CloudGenerationInput,
} from "@mangai/ai-core";
import { createClient } from "@/lib/supabase/server";
import {
  CLOUD_ASSET_BUCKET,
  CLOUD_PROJECT_MAX_BYTES,
  cloudAssetStoragePath,
  parseCloudProjectImport,
  validateCloudAssetBytes,
} from "@/lib/cloud-creator-contract";
import { selectCloudProvider } from "@/lib/cloud-ai-registry";

async function apiContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です。");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,role")
    .eq("user_id", user.id)
    .single();
  if (error || !profile) throw new Error("プロフィールが必要です。");
  if (profile.role !== "creator" && profile.role !== "admin")
    throw new Error("Cloud Creatorを利用するにはクリエイター登録が必要です。");
  return { supabase, profile };
}

export type CloudProjectSummary = {
  id: string;
  title: string;
  description: string;
  age_rating: "全年齢" | "12歳以上" | "15歳以上";
  reading_direction: "rtl" | "ltr";
  width: number;
  height: number;
  dpi: number;
  visibility: "private" | "unlisted" | "public";
  revision: number;
  storage_bytes: number;
  source_surface: "cloud" | "desktop";
  cover_page_id: string | null;
  updated_at: string;
};

export type CloudEpisode = {
  id: string;
  project_id: string;
  title: string;
  order_index: number;
  revision: number;
};

export type CloudPage = {
  id: string;
  project_id: string;
  episode_id: string;
  page_number: number;
  order_index: number;
  width: number;
  height: number;
  background_color: string;
  revision: number;
};

export type CloudGenerationJob = {
  id: string;
  project_id: string;
  page_id: string | null;
  kind: "image" | "text";
  job_type: CloudGenerationInput["jobType"];
  provider_id: string;
  model_id: string;
  status: "queued" | "running" | "completed" | "failed" | "canceled";
  progress: number;
  attempt_count: number;
  max_attempts: number;
  estimated_cost_micros: number | null;
  actual_cost_micros: number | null;
  output: Record<string, unknown> | null;
  output_asset_id: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export async function enqueueCloudGenerationJob(input: {
  projectId: string;
  pageId?: string;
  idempotencyKey: string;
  generation: unknown;
}) {
  const generation = cloudGenerationInputSchema.parse(input.generation);
  const moderation = moderateGeneralCloudPrompt(
    `${generation.prompt}\n${generation.negativePrompt}`,
  );
  if (moderation.decision !== "allow") {
    const reason = moderation.reasons.join(", ") || "classification_required";
    throw new Error(`Cloud AI送信前確認で拒否されました: ${reason}`);
  }
  const capability = selectCloudProvider(generation);
  const { supabase } = await apiContext();
  const promptSha256 = crypto
    .createHash("sha256")
    .update(generation.prompt, "utf8")
    .digest("hex");
  const { data, error } = await supabase.rpc("enqueue_cloud_generation_job", {
    p_project_id: input.projectId,
    p_page_id: input.pageId ?? null,
    p_kind: generation.kind,
    p_job_type: generation.jobType,
    p_provider_id: capability.providerId,
    p_model_id: capability.modelId,
    p_idempotency_key: input.idempotencyKey,
    p_prompt_sha256: promptSha256,
    p_input: generation,
    p_moderation: moderation,
    p_estimated_cost_micros: null,
  });
  if (error || !data) throw new Error("Cloud AI Jobを登録できませんでした。");
  return data as string;
}

export async function listCloudGenerationJobs(projectId: string) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase
    .from("cloud_generation_jobs")
    .select(
      "id,project_id,page_id,kind,job_type,provider_id,model_id,status,progress,attempt_count,max_attempts,estimated_cost_micros,actual_cost_micros,output,output_asset_id,error_code,error_message,created_at,updated_at",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Cloud AI生成履歴を読み込めませんでした。");
  return (data ?? []) as CloudGenerationJob[];
}

export async function cancelCloudGenerationJob(jobId: string) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("cancel_cloud_generation_job", {
    p_job_id: jobId,
  });
  if (error || !data)
    throw new Error("Cloud AI Jobをキャンセルできませんでした。");
  return data as string;
}

function normalizeCloudCanvas(
  page: Pick<CloudPage, "id" | "width" | "height" | "background_color">,
  value: unknown,
) {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const canvas = pageCanvasSchema.safeParse({
    schemaVersion: 1,
    pageId: page.id,
    width: page.width,
    height: page.height,
    backgroundColor: source.backgroundColor ?? page.background_color,
    panels: source.panels ?? [],
    panelLayers: source.panelLayers ?? [],
    balloons: source.balloons ?? [],
    textObjects: source.textObjects ?? [],
  });
  if (!canvas.success)
    throw new Error("Canvasデータが不正なため、安全に読み込めませんでした。");
  return canvas.data;
}

export async function listCloudProjects() {
  const { supabase } = await apiContext();
  const { data, error } = await supabase
    .from("cloud_projects")
    .select(
      "id,title,description,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Cloud Project一覧を読み込めませんでした。");
  return (data ?? []) as CloudProjectSummary[];
}

export async function listDeletedCloudProjects() {
  const { supabase } = await apiContext();
  const { data, error } = await supabase
    .from("cloud_projects")
    .select(
      "id,title,description,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,updated_at,deleted_at",
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) throw new Error("Cloud Projectのゴミ箱を読み込めませんでした。");
  return (data ?? []) as Array<CloudProjectSummary & { deleted_at: string }>;
}

export async function getCloudProjectWorkspace(projectId: string) {
  const { supabase } = await apiContext();
  const [{ data: project, error: projectError }, episodesResult, pagesResult] =
    await Promise.all([
      supabase
        .from("cloud_projects")
        .select(
          "id,title,description,age_rating,reading_direction,width,height,dpi,visibility,revision,storage_bytes,source_surface,cover_page_id,updated_at",
        )
        .eq("id", projectId)
        .is("deleted_at", null)
        .single(),
      supabase
        .from("cloud_episodes")
        .select("id,project_id,title,order_index,revision")
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("order_index"),
      supabase
        .from("cloud_pages")
        .select(
          "id,project_id,episode_id,page_number,order_index,width,height,background_color,revision",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null)
        .order("page_number"),
    ]);
  if (projectError || !project)
    throw new Error("Cloud Projectが見つかりません。");
  if (episodesResult.error || pagesResult.error)
    throw new Error("Episode／Pageを読み込めませんでした。");
  return {
    project: project as CloudProjectSummary,
    episodes: (episodesResult.data ?? []) as CloudEpisode[],
    pages: (pagesResult.data ?? []) as CloudPage[],
  };
}

export async function createCloudProject(input: {
  title: string;
  description: string;
  ageRating: "全年齢" | "12歳以上" | "15歳以上";
  readingDirection: "rtl" | "ltr";
  width: number;
  height: number;
  dpi: number;
}) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc(
    "create_cloud_project_with_first_page",
    {
      p_title: input.title,
      p_description: input.description,
      p_age_rating: input.ageRating,
      p_reading_direction: input.readingDirection,
      p_width: input.width,
      p_height: input.height,
      p_dpi: input.dpi,
    },
  );
  if (error || !data?.[0]?.project_id)
    throw new Error("Cloud Projectを作成できませんでした。");
  return data[0] as {
    project_id: string;
    episode_id: string;
    page_id: string;
  };
}

export async function addCloudEpisode(projectId: string, title: string) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("add_cloud_episode", {
    p_project_id: projectId,
    p_title: title,
  });
  if (error || !data) throw new Error("Episodeを追加できませんでした。");
  return data as string;
}

export async function addCloudPage(episodeId: string) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("add_cloud_page", {
    p_episode_id: episodeId,
  });
  if (error || !data) throw new Error("Pageを追加できませんでした。");
  return data as string;
}

export async function renameCloudProject(
  projectId: string,
  title: string,
  description: string,
) {
  const { supabase } = await apiContext();
  const { error } = await supabase.rpc("rename_cloud_project", {
    p_project_id: projectId,
    p_title: title,
    p_description: description,
  });
  if (error) throw new Error("Project情報を更新できませんでした。");
}

export async function renameCloudEpisode(episodeId: string, title: string) {
  const { supabase } = await apiContext();
  const { error } = await supabase.rpc("rename_cloud_episode", {
    p_episode_id: episodeId,
    p_title: title,
  });
  if (error) throw new Error("Episode名を更新できませんでした。");
}

export async function moveCloudStructure(
  kind: "episode" | "page",
  id: string,
  direction: -1 | 1,
) {
  const { supabase } = await apiContext();
  const { error } = await supabase.rpc(
    kind === "episode" ? "move_cloud_episode" : "move_cloud_page",
    kind === "episode"
      ? { p_episode_id: id, p_direction: direction }
      : { p_page_id: id, p_direction: direction },
  );
  if (error)
    throw new Error(
      `${kind === "episode" ? "Episode" : "Page"}を移動できませんでした。`,
    );
}

export async function deleteCloudStructure(
  kind: "episode" | "page",
  id: string,
) {
  const { supabase } = await apiContext();
  const { error } = await supabase.rpc(
    kind === "episode" ? "soft_delete_cloud_episode" : "soft_delete_cloud_page",
    kind === "episode" ? { p_episode_id: id } : { p_page_id: id },
  );
  if (error) {
    if (error.message.includes("last_episode"))
      throw new Error("最後のEpisodeは削除できません。");
    if (error.message.includes("last_page"))
      throw new Error("最後のPageは削除できません。");
    throw new Error(
      `${kind === "episode" ? "Episode" : "Page"}を削除できませんでした。`,
    );
  }
}

export async function setCloudProjectCover(projectId: string, pageId: string) {
  const { supabase } = await apiContext();
  const { error } = await supabase.rpc("set_cloud_project_cover", {
    p_project_id: projectId,
    p_page_id: pageId,
  });
  if (error) throw new Error("表紙Pageを設定できませんでした。");
}

export async function importDesktopCloudProject(value: unknown) {
  const manifest = parseCloudProjectImport(value);
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("import_cloud_project", {
    p_manifest: manifest,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("このDesktop Projectはすでにimportされています。");
    throw new Error("Cloud Projectをimportできませんでした。");
  }
  return data as string;
}

export async function saveCloudPageSnapshot(input: {
  pageId: string;
  expectedRevision: number;
  canvas: PageCanvas;
}) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc("save_cloud_page_snapshot", {
    p_page_id: input.pageId,
    p_expected_revision: input.expectedRevision,
    p_canvas: input.canvas,
  });
  if (error) {
    if (error.message.includes("revision_conflict"))
      throw new Error("保存競合を検出しました。Pageを再読込してください。");
    throw new Error("Pageを保存できませんでした。");
  }
  return data as { page_id: string; revision: number; updated_at: string }[];
}

export async function getCloudPageSnapshot(pageId: string) {
  const { supabase } = await apiContext();
  const { data: page, error } = await supabase
    .from("cloud_pages")
    .select("id,project_id,revision,width,height,background_color,updated_at")
    .eq("id", pageId)
    .is("deleted_at", null)
    .single();
  if (error || !page) throw new Error("Pageが見つかりません。");
  const { data: snapshot, error: snapshotError } = await supabase
    .from("cloud_canvas_snapshots")
    .select("revision,canvas,created_at")
    .eq("page_id", pageId)
    .eq("revision", page.revision)
    .maybeSingle();
  if (snapshotError) throw new Error("Canvasを読み込めませんでした。");
  return {
    ...page,
    canvas: normalizeCloudCanvas(page, snapshot?.canvas),
    snapshot,
  };
}

export type CloudAsset = {
  id: string;
  project_id: string;
  file_name: string;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  byte_size: number;
  width: number;
  height: number;
  sha256: string;
  url: string;
};

export async function listCloudAssets(projectId: string) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase
    .from("cloud_assets")
    .select(
      "id,project_id,file_name,mime_type,byte_size,width,height,sha256,storage_path",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Asset Libraryを読み込めませんでした。");
  return Promise.all(
    (data ?? []).map(async (asset) => {
      const { data: signed, error: signedError } = await supabase.storage
        .from(CLOUD_ASSET_BUCKET)
        .createSignedUrl(asset.storage_path, 300);
      if (signedError || !signed?.signedUrl)
        throw new Error("Assetの署名URLを作成できませんでした。");
      const { storage_path: _storagePath, ...metadata } = asset;
      return { ...metadata, url: signed.signedUrl } as CloudAsset;
    }),
  );
}

export async function getCloudProjectExportBundle(projectId: string) {
  const { supabase } = await apiContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const pageIds = workspace.pages.map((page) => page.id);
  const [
    { data: snapshots, error: snapshotError },
    { data: assets, error: assetError },
  ] = await Promise.all([
    pageIds.length
      ? supabase
          .from("cloud_canvas_snapshots")
          .select("page_id,revision,canvas")
          .in("page_id", pageIds)
          .order("revision", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("cloud_assets")
      .select(
        "id,project_id,file_name,mime_type,byte_size,width,height,sha256,storage_path",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null),
  ]);
  if (snapshotError || assetError)
    throw new Error("Exportデータを読み込めませんでした。");
  const latestSnapshots = new Map<string, unknown>();
  for (const snapshot of snapshots ?? []) {
    if (!latestSnapshots.has(snapshot.page_id))
      latestSnapshots.set(snapshot.page_id, snapshot.canvas);
  }
  const assetFiles = await Promise.all(
    (assets ?? []).map(async (asset) => {
      const { data, error } = await supabase.storage
        .from(CLOUD_ASSET_BUCKET)
        .download(asset.storage_path);
      if (error || !data)
        throw new Error(`Asset「${asset.file_name}」を読み込めませんでした。`);
      const { storage_path: _storagePath, ...metadata } = asset;
      return { ...metadata, bytes: new Uint8Array(await data.arrayBuffer()) };
    }),
  );
  return {
    ...workspace,
    pages: workspace.pages.map((page) => ({
      ...page,
      canvas: normalizeCloudCanvas(page, latestSnapshots.get(page.id)),
    })),
    assets: assetFiles,
  };
}

export async function setCloudProjectDeleted(
  projectId: string,
  deleted: boolean,
) {
  const { supabase } = await apiContext();
  const { data, error } = await supabase.rpc(
    deleted ? "soft_delete_cloud_project" : "restore_cloud_project",
    { p_project_id: projectId },
  );
  if (error)
    throw new Error(
      deleted
        ? "Cloud Projectをゴミ箱へ移動できませんでした。"
        : "Cloud Projectを復元できませんでした。",
    );
  return data as string;
}

export async function uploadCloudAsset(input: {
  projectId: string;
  assetId?: string;
  expectedSha256?: string;
  fileName: string;
  bytes: Uint8Array;
  mimeType: unknown;
}) {
  const { supabase, profile } = await apiContext();
  const validation = await validateCloudAssetBytes({
    bytes: input.bytes,
    declaredMimeType: input.mimeType,
  });
  if (input.expectedSha256 && input.expectedSha256 !== validation.sha256)
    throw new Error("Desktop manifestと画像のSHA-256が一致しません。");
  const { data: project, error: projectError } = await supabase
    .from("cloud_projects")
    .select("id,storage_bytes")
    .eq("id", input.projectId)
    .is("deleted_at", null)
    .single();
  if (projectError || !project)
    throw new Error("Cloud Projectが見つかりません。");
  const storedBytes = Number(project.storage_bytes);
  if (
    !Number.isSafeInteger(storedBytes) ||
    storedBytes < 0 ||
    storedBytes + validation.byteSize > CLOUD_PROJECT_MAX_BYTES
  )
    throw new Error("Projectの保存容量上限2GBを超えます。");
  const assetId = input.assetId ?? crypto.randomUUID();
  const storagePath = cloudAssetStoragePath({
    profileId: profile.id,
    projectId: input.projectId,
    assetId,
    mimeType: validation.mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(CLOUD_ASSET_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: validation.mimeType,
      upsert: false,
    });
  if (uploadError)
    throw new Error("画像を非公開Storageへ保存できませんでした。");
  const { data: asset, error: insertError } = await supabase
    .from("cloud_assets")
    .insert({
      id: assetId,
      project_id: input.projectId,
      owner_profile_id: profile.id,
      storage_path: storagePath,
      file_name: input.fileName.slice(0, 255),
      ...{
        mime_type: validation.mimeType,
        byte_size: validation.byteSize,
        width: validation.width,
        height: validation.height,
        sha256: validation.sha256,
      },
    })
    .select("*")
    .single();
  if (insertError || !asset) {
    await supabase.storage.from(CLOUD_ASSET_BUCKET).remove([storagePath]);
    throw new Error("画像情報を保存できませんでした。");
  }
  return asset;
}

export async function createCloudAssetSignedUrl(assetId: string) {
  const supabase = await createClient();
  const { data: asset, error } = await supabase
    .from("cloud_assets")
    .select("storage_path")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
  if (error || !asset) throw new Error("Assetが見つかりません。");
  const { data, error: signedUrlError } = await supabase.storage
    .from(CLOUD_ASSET_BUCKET)
    .createSignedUrl(asset.storage_path, 300);
  if (signedUrlError || !data?.signedUrl)
    throw new Error("署名URLを作成できませんでした。");
  return data.signedUrl;
}
