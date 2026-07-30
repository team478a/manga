import Link from "next/link";
import { notFound } from "next/navigation";
import { FileArchive, FileDown, LockKeyhole, PencilRuler } from "lucide-react";
import {
  cloudAdultWorkManagementFeatureEnabled,
  cloudAdultWorkStatusLabels,
} from "@/lib/cloud-adult-work-management";
import { getCloudAdultWork } from "@/lib/cloud-adult-work-management-server";
import { getCloudProjectWorkspace } from "@/lib/cloud-creator-server";
import { updateCloudAdultWorkAction } from "../actions";

export default async function CloudAdultWorkDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  if (!cloudAdultWorkManagementFeatureEnabled()) notFound();
  const { projectId } = await params;
  const query = await searchParams;
  let work;
  let workspace;
  try {
    [work, workspace] = await Promise.all([
      getCloudAdultWork(projectId),
      getCloudProjectWorkspace(projectId),
    ]);
  } catch {
    notFound();
  }
  const firstPage = workspace.pages[0];
  return (
    <main className="page max-w-5xl">
      <Link className="text-violet-700 underline" href="/dashboard/adult-works">
        ← 成人向け作品一覧
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-rose-700">成人向け・非公開</p>
          <h1 className="mt-1 break-words text-3xl font-bold">
            {work.project.title}
          </h1>
          <p className="mt-2 text-stone-600">
            {workspace.pages.length}ページ・
            {cloudAdultWorkStatusLabels[work.status]}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-rose-100 px-4 py-2 font-bold text-rose-800">
          <LockKeyhole className="h-4 w-4" />
          本人限定
        </span>
      </div>
      {query.error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {query.error}
        </p>
      ) : null}
      {query.message ? (
        <p className="mt-5 rounded-lg bg-green-50 p-4 text-green-800" role="status">
          {query.message}
        </p>
      ) : null}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link className="panel transition hover:border-violet-300" href={`/creator/${projectId}`}>
          <PencilRuler className="h-6 w-6 text-violet-700" />
          <h2 className="mt-3 font-bold">Projectを編集</h2>
          <p className="mt-1 text-sm text-stone-600">構成、表紙、ページを管理</p>
        </Link>
        {firstPage ? (
          <Link
            className="panel transition hover:border-violet-300"
            href={`/creator/${projectId}/pages/${firstPage.id}`}
          >
            <PencilRuler className="h-6 w-6 text-violet-700" />
            <h2 className="mt-3 font-bold">Canvasを開く</h2>
            <p className="mt-1 text-sm text-stone-600">コマ・吹き出し・文字を編集</p>
          </Link>
        ) : (
          <div className="panel text-stone-400">編集できるページがありません</div>
        )}
        <div className="panel">
          <FileArchive className="h-6 w-6 text-violet-700" />
          <h2 className="mt-3 font-bold">非公開書き出し</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              className="button-secondary text-sm"
              href={`/api/creator/projects/${encodeURIComponent(projectId)}/export?format=pdf`}
            >
              <FileDown className="mr-1 h-4 w-4" />
              PDF
            </a>
            <a
              className="button-secondary text-sm"
              href={`/api/creator/projects/${encodeURIComponent(projectId)}/export?format=images`}
            >
              連番画像
            </a>
          </div>
        </div>
      </section>
      <form
        action={updateCloudAdultWorkAction.bind(null, projectId)}
        className="panel mt-6 space-y-5"
      >
        <div>
          <h2 className="text-xl font-bold">作品情報</h2>
          <p className="mt-1 text-sm text-stone-600">
            この情報は一般公開やMarketplaceへ送信されません。
          </p>
        </div>
        <div>
          <label className="label" htmlFor="adult-work-title">タイトル</label>
          <input
            className="field"
            defaultValue={work.project.title}
            id="adult-work-title"
            maxLength={200}
            name="title"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="adult-work-description">説明</label>
          <textarea
            className="field min-h-28"
            defaultValue={work.project.description}
            id="adult-work-description"
            maxLength={5000}
            name="description"
          />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="adult-work-status">制作状態</label>
            <select
              className="field"
              defaultValue={work.status}
              id="adult-work-status"
              name="status"
            >
              {Object.entries(cloudAdultWorkStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="adult-work-notes">非公開メモ</label>
            <textarea
              className="field min-h-24"
              defaultValue={work.notes}
              id="adult-work-notes"
              maxLength={2000}
              name="notes"
            />
          </div>
        </div>
        <button className="button bg-violet-700 hover:bg-violet-800" type="submit">
          作品情報を保存
        </button>
      </form>
      <section className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-950">
        <h2 className="font-bold">成人向け作品の安全境界</h2>
        <p className="mt-2">
          公開、共同編集、Marketplace、販売パッケージ、Cloud画像生成は利用できません。
          PDFと連番画像は本人の端末へ書き出す用途に限定しています。
        </p>
      </section>
    </main>
  );
}
