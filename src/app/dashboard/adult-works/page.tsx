import Link from "next/link";
import { FileDown, LockKeyhole, PencilRuler } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import {
  cloudAdultWorkManagementFeatureEnabled,
  cloudAdultWorkStatusLabels,
} from "@/lib/cloud-adult-work-management";
import { listCloudAdultWorks } from "@/lib/cloud-adult-work-management-server";

export default async function CloudAdultWorksPage() {
  if (!cloudAdultWorkManagementFeatureEnabled())
    return (
      <main className="page">
        <h1 className="text-3xl font-bold">成人向け作品管理</h1>
        <div className="panel mt-6">
          <h2 className="text-xl font-bold">現在は利用できません</h2>
          <p className="mt-2 text-stone-600">
            成人向け作品管理は管理者が許可した利用者へ段階的に提供します。
          </p>
        </div>
      </main>
    );

  let works;
  try {
    works = await listCloudAdultWorks();
  } catch {
    return (
      <main className="page">
        <h1 className="text-3xl font-bold">成人向け作品管理</h1>
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-amber-950" role="alert">
          作品管理を読み込めませんでした。利用許可または管理設定をご確認ください。
        </p>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-semibold text-rose-700">許可制・本人限定</p>
          <h1 className="mt-1 text-3xl font-bold">成人向け作品管理</h1>
          <p className="mt-2 text-stone-600">
            成人向けCanvasを非公開のまま編集・整理・書き出しできます。
          </p>
        </div>
        <Link className="button-secondary" href="/dashboard/works">
          一般向け作品へ
        </Link>
      </div>
      <Link className="button-secondary mt-4" href="/dashboard/adult-monitor">
        モニターフィードバック
      </Link>
      <div className="mt-5 flex flex-wrap gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">
        <span className="flex items-center gap-2">
          <LockKeyhole className="h-4 w-4" />
          公開・販売・共同編集なし
        </span>
        <span className="flex items-center gap-2">
          <PencilRuler className="h-4 w-4" />
          Canvas編集
        </span>
        <span className="flex items-center gap-2">
          <FileDown className="h-4 w-4" />
          PDF・連番画像
        </span>
      </div>
      {works.length ? (
        <section className="mt-7 grid gap-4 lg:grid-cols-2">
          {works.map((work) => (
            <article className="panel min-w-0" key={work.project_id}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800">
                  成人向け・18歳以上
                </span>
                <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">
                  {cloudAdultWorkStatusLabels[work.status]}
                </span>
              </div>
              <h2 className="mt-4 break-words text-2xl font-bold">
                {work.project.title}
              </h2>
              <p className="mt-2 line-clamp-3 break-words text-stone-600">
                {work.project.description || "説明はまだありません。"}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-stone-500">更新</dt>
                  <dd className="font-semibold">
                    {new Date(work.updated_at).toLocaleDateString("ja-JP")}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">Revision</dt>
                  <dd className="font-semibold">{work.project.revision}</dd>
                </div>
              </dl>
              <Link
                className="button mt-5 w-full bg-violet-700 hover:bg-violet-800"
                href={`/dashboard/adult-works/${work.project_id}`}
              >
                作品を管理
              </Link>
            </article>
          ))}
        </section>
      ) : (
        <div className="mt-7">
          <EmptyState
            title="成人向け作品はまだありません"
            body="採用済みの成人向けネームをCanvas下書きへ変換すると、ここに表示されます。"
            href="/dashboard/research"
            action="制作フローへ戻る"
          />
        </div>
      )}
    </main>
  );
}
