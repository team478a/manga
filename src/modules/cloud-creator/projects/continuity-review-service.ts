import { evaluateCloudContinuity } from "@/lib/cloud-continuity-review";
import { DomainError } from "@/lib/domain-errors";
import { cloudCreatorContext } from "../auth-context";
import { normalizeCloudCanvas } from "../canvas/canvas-normalizer";
import { getCloudProjectWorkspace } from "./project-service";

export async function getCloudContinuityReview(projectId: string) {
  const { supabase } = await cloudCreatorContext();
  const workspace = await getCloudProjectWorkspace(projectId);
  const pageIds = workspace.pages.map((page) => page.id);
  const [snapshots, jobs, characters, worlds, style, references, assignments] =
    await Promise.all([
      pageIds.length
        ? supabase
            .from("cloud_canvas_snapshots")
            .select("page_id,revision,canvas")
            .in("page_id", pageIds)
            .order("revision", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("cloud_generation_jobs")
        .select("id,input")
        .eq("project_id", projectId)
        .eq("kind", "image"),
      supabase
        .from("cloud_character_profiles")
        .select("id,name,current_version")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      supabase
        .from("cloud_world_profiles")
        .select("id,name,kind,current_version")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      supabase
        .from("cloud_style_bibles")
        .select("id,current_version")
        .eq("project_id", projectId)
        .maybeSingle(),
      supabase
        .from("cloud_visual_reference_assets")
        .select("subject_kind,subject_id,asset_id")
        .eq("project_id", projectId),
      supabase
        .from("cloud_panel_subject_assignments")
        .select("page_id,panel_id,subject_kind,subject_id")
        .eq("project_id", projectId),
    ]);
  const results = [snapshots, jobs, characters, worlds, style, references, assignments];
  const unavailable = results.some((result) => result.error?.code === "42P01");
  if (unavailable)
    return {
      available: false,
      review: evaluateCloudContinuity({
        placements: [],
        assignments: [],
        subjects: [],
        style: null,
      }),
    };
  const failure = results.find((result) => result.error);
  if (failure?.error)
    throw new DomainError(
      "INTERNAL_ERROR",
      "一貫性チェックを実行できませんでした。",
      { cause: failure.error },
    );

  const latest = new Map<string, unknown>();
  for (const snapshot of snapshots.data ?? [])
    if (!latest.has(snapshot.page_id)) latest.set(snapshot.page_id, snapshot.canvas);
  const jobMap = new Map((jobs.data ?? []).map((job) => [job.id, job.input]));
  const placements = workspace.pages.flatMap((page) => {
    const canvas = normalizeCloudCanvas(page, latest.get(page.id));
    return canvas.panelLayers
      .filter((layer) => layer.visible && Boolean(layer.sourceJobId))
      .map((layer) => ({
        pageId: page.id,
        pageNumber: page.page_number,
        panelId: layer.panelId,
        sourceJobId: layer.sourceJobId!,
        jobInput: jobMap.get(layer.sourceJobId!) ?? null,
      }));
  });
  const referenceMap = new Map<string, string[]>();
  for (const reference of references.data ?? []) {
    const current = referenceMap.get(reference.subject_id) ?? [];
    current.push(reference.asset_id);
    referenceMap.set(reference.subject_id, current);
  }
  const subjects = [
    ...(characters.data ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      kind: "character" as const,
      currentVersion: subject.current_version,
      referenceAssetIds: referenceMap.get(subject.id) ?? [],
    })),
    ...(worlds.data ?? []).map((subject) => ({
      id: subject.id,
      name: subject.name,
      kind: subject.kind as "location" | "prop",
      currentVersion: subject.current_version,
      referenceAssetIds: referenceMap.get(subject.id) ?? [],
    })),
  ];
  return {
    available: true,
    review: evaluateCloudContinuity({
      placements,
      assignments: (assignments.data ?? []).map((assignment) => ({
        pageId: assignment.page_id,
        panelId: assignment.panel_id,
        subjectId: assignment.subject_id,
        kind: assignment.subject_kind as "character" | "location" | "prop",
      })),
      subjects,
      style: style.data
        ? {
            id: style.data.id,
            currentVersion: style.data.current_version,
            referenceAssetIds: referenceMap.get(style.data.id) ?? [],
          }
        : null,
    }),
  };
}
