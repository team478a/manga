import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  acceptExternalSellerTermsAction,
  createExternalSubmissionAction,
} from "./actions";
import { EXTERNAL_SELLER_TERMS_VERSION } from "./constants";

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
  const termsAccepted = seller?.terms_version === EXTERNAL_SELLER_TERMS_VERSION;
  return (
    <main className="page max-w-4xl">
      <h1 className="text-3xl font-bold">外部作品の応募</h1>
      <p className="mt-3 text-lg text-stone-600">
        招待済みの一般向け作品を、非公開の隔離領域で検証してから審査に送ります。
      </p>
      {params.error ? <InlineErrorMessage>{params.error}</InlineErrorMessage> : null}
      {profile.role !== "creator" ? (
        <div className="panel mt-6">
          <h2 className="text-xl font-semibold">creatorアカウントが必要です</h2>
          <p className="mt-2 text-stone-600">
            管理者アカウントでは出品者規約への同意を記録できません。応募するcreatorアカウントでログインしてください。
          </p>
          {profile.role === "admin" ? (
            <Link className="mt-4 inline-block text-emerald-700" href="/admin/external-submissions">
              出品者の招待承認を開く
            </Link>
          ) : null}
        </div>
      ) : !termsAccepted ? (
        <div className="panel mt-6">
          <h2 className="text-xl font-semibold">出品者規約の確認</h2>
          <p className="mt-2 text-stone-600">
            本機能は招待制の一般向け作品応募です。権利申告、安全検査、管理者審査を経た作品だけを公開でき、精算・送金はこのMVPに含まれません。
          </p>
          <form action={acceptExternalSellerTermsAction} className="mt-4 space-y-4">
            <label className="flex items-start gap-3">
              <input className="mt-1" name="termsAccepted" required type="checkbox" />
              <span>
                出品者規約（{EXTERNAL_SELLER_TERMS_VERSION}）と上記の提供範囲を確認し、一般向け作品だけを応募します。
              </span>
            </label>
            <PendingSubmitButton className="button" pendingLabel="同意を記録中…">
              規約に同意して承認を申請
            </PendingSubmitButton>
          </form>
        </div>
      ) : !eligible ? (
        <div className="panel mt-6">
          <h2 className="text-xl font-semibold">
            {seller?.status === "suspended" ? "出品者利用は停止中です" : "管理者の承認待ちです"}
          </h2>
          <p className="mt-2 text-stone-600">
            {seller?.status === "suspended"
              ? "現在は新しい応募を開始できません。運営へお問い合わせください。"
              : "規約への同意は記録済みです。招待承認後に応募下書きを作成できます。"}
          </p>
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
