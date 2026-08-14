import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { ResourceNotFoundError } from "@/lib/domain-errors";
import { getCloudProjectWorkspace } from "@/modules/cloud-creator/projects/project-service";
import { getCloudProjectCompletion } from "@/modules/cloud-creator/projects/page-completion-service";
import { ManuscriptPreview } from "./ManuscriptPreview";

export default async function CloudManuscriptPreviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  await requireProfile();
  const { projectId } = await params;
  let workspace: Awaited<ReturnType<typeof getCloudProjectWorkspace>>;
  let completion: Awaited<ReturnType<typeof getCloudProjectCompletion>>;
  try {
    [workspace, completion] = await Promise.all([
      getCloudProjectWorkspace(projectId),
      getCloudProjectCompletion(projectId),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  return (
    <main className="page">
      <Link className="text-leaf underline" href={`/creator/${projectId}`}>← 制作プロジェクトへ</Link>
      <div className="my-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><h1 className="text-3xl font-bold">{workspace.project.title} 原稿プレビュー</h1><p className="mt-2 text-stone-600">保存済みCanvasの最新revisionを、ページ全体が切れない状態で表示します。</p></div>
        <Link className="button-secondary" href={`/creator/${projectId}#durable-export`}><FileText className="h-4 w-4" />完成原稿PDF</Link>
      </div>
      <div className={`mb-5 rounded-lg p-4 ${completion.complete ? "bg-green-50 text-green-900" : "bg-amber-50 text-amber-950"}`} role="status">
        完成 {completion.completedPages}/{completion.totalPages}ページ（{completion.completionPercent}%）・生成中 {completion.generatingPages}・未完成 {completion.incompletePages}・確認待ち {completion.reviewRequiredPages}
      </div>
      <ManuscriptPreview pages={completion.pages} projectId={projectId} />
    </main>
  );
}
