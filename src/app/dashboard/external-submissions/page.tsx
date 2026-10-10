import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createExternalSubmissionAction } from "./actions";

export default async function ExternalSubmissionsPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: seller }, { data: submissions }] = await Promise.all([
    supabase.from("external_seller_profiles").select("status,terms_version").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("external_work_submissions").select("id,title,status,source_format,updated_at").order("updated_at", { ascending: false }),
  ]);
  const eligible = seller?.status === "eligible";
  return (
    <main className="page max-w-4xl">
      <h1 className="text-3xl font-bold">外部作品の応募</h1>
      <p className="mt-3 text-lg text-stone-600">
        招待済みの一般向け作品を、非公開の隔離領域で検証してから審査に送ります。
      </p>
      {params.error ? <InlineErrorMessage>{params.error}</InlineErrorMessage> : null}
      {!eligible ? (
        <div className="panel mt-6">
          <h2 className="text-xl font-semibold">現在は応募できません</h2>
          <p className="mt-2 text-stone-600">出品者規約への同意と管理者の招待承認が必要です。</p>
        </div>
      ) : (
        <form action={createExternalSubmissionAction} className="panel mt-6 space-y-4">
          <h2 className="text-xl font-semibold">新しい応募下書き</h2>
          <div><label className="label" htmlFor="title">作品名</label><input className="field" id="title" name="title" maxLength={160} required /></div>
          <div><label className="label" htmlFor="description">作品説明</label><textarea className="field min-h-28" id="description" name="description" maxLength={5000} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="ageRating">対象年齢</label><select className="field" id="ageRating" name="ageRating"><option>全年齢</option><option>12歳以上</option><option>15歳以上</option></select></div>
            <div><label className="label" htmlFor="sourceFormat">原稿形式</label><select className="field" id="sourceFormat" name="sourceFormat"><option value="pdf">PDF</option><option value="zip">ZIP画像</option><option value="images">画像</option></select></div>
          </div>
          <PendingSubmitButton className="button" pendingLabel="下書きを作成中…">下書きを作成</PendingSubmitButton>
        </form>
      )}
      <section className="mt-8">
        <h2 className="text-xl font-semibold">応募一覧</h2>
        <div className="mt-3 grid gap-3">
          {(submissions ?? []).map((submission) => (
            <Link className="panel block" href={`/dashboard/external-submissions/${submission.id}`} key={submission.id}>
              <span className="font-semibold">{submission.title}</span>
              <span className="ml-3 text-sm text-stone-600">{submission.status} / {submission.source_format}</span>
            </Link>
          ))}
          {!submissions?.length ? <p className="text-stone-600">応募下書きはありません。</p> : null}
        </div>
      </section>
    </main>
  );
}
