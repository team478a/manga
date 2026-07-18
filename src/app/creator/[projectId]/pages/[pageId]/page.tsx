import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import {
  getCloudPageSnapshot,
  getCloudProjectWorkspace,
  listCloudAssets,
} from "@/lib/cloud-creator-server";
import { CloudCanvasEditor } from "./CloudCanvasEditor";

export default async function CloudCanvasPage({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}) {
  await requireProfile();
  const { projectId, pageId } = await params;
  let workspace: Awaited<ReturnType<typeof getCloudProjectWorkspace>>;
  let snapshot: Awaited<ReturnType<typeof getCloudPageSnapshot>>;
  let assets: Awaited<ReturnType<typeof listCloudAssets>>;
  try {
    [workspace, snapshot, assets] = await Promise.all([
      getCloudProjectWorkspace(projectId),
      getCloudPageSnapshot(pageId),
      listCloudAssets(projectId),
    ]);
  } catch {
    notFound();
  }
  const page = workspace.pages.find((candidate) => candidate.id === pageId);
  if (!page || snapshot.project_id !== projectId) notFound();
  return (
    <CloudCanvasEditor
      project={workspace.project}
      pages={workspace.pages}
      page={page}
      initialCanvas={snapshot.canvas}
      initialAssets={assets}
    />
  );
}
