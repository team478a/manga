import Link from "next/link";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  reviewExternalSubmissionAction,
  stopExternalListingAction,
  updateExternalSellerStatusAction,
} from "./actions";

type Submission = {
  id: string; title: string; description: string; status: string; age_rating: string;
  asking_price: number | null; review_reason_code: string | null; owner_profile_id: string;
  work_id: string | null; product_id: string | null; publication_id: string | null;
};

type Seller = {
  profile_id: string;
  status: "draft" | "eligible" | "suspended";
  terms_version: string | null;
  terms_accepted_at: string | null;
  approved_at: string | null;
  suspension_reason_code: string | null;
  profiles: { display_name: string | null } | null;
};

export default async function AdminExternalSubmissionsPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const supabase = await createClient();
  const [{ data }, { data: sellers }] = await Promise.all([
    supabase.from("external_work_submissions")
      .select("id,title,description,status,age_rating,asking_price,review_reason_code,owner_profile_id,work_id,product_id,publication_id")
      .in("status", ["submitted", "in_review", "approved", "rejected", "published", "paused"])
      .order("submitted_at", { ascending: true }).returns<Submission[]>(),
    supabase.from("external_seller_profiles")
      .select("profile_id,status,terms_version,terms_accepted_at,approved_at,suspension_reason_code,profiles:profile_id(display_name)")
      .order("updated_at", { ascending: false }).returns<Seller[]>(),
  ]);
  return <main className="page max-w-6xl">
    <h1 className="text-3xl font-bold">外部作品審査</h1>
    <p className="mt-3 text-stone-600">権利申告、価格、検証済み固定版の状態を確認し、承認または差し戻します。承認だけでは販売開始されません。</p>
    {params.error ? <InlineErrorMessage>{params.error}</InlineErrorMessage> : null}
    <section className="mt-6">
      <h2 className="text-2xl font-semibold">出品者の招待承認</h2>
      <p className="mt-2 text-stone-600">規約へ同意したcreatorだけを承認できます。停止後も既存の監査記録は保持されます。</p>
      <div className="mt-3 grid gap-4">{(sellers ?? []).map((seller) => <article className="panel" key={seller.profile_id}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="text-lg font-semibold">{seller.profiles?.display_name || "名称未設定"}</h3>
          <p className="mt-1 text-sm text-stone-600">{seller.status} / 規約 {seller.terms_version ?? "未同意"}</p></div>
          <details><summary className="cursor-pointer text-sm text-stone-500">管理用ID</summary><code className="text-xs">{seller.profile_id}</code></details>
        </div>
        {seller.suspension_reason_code ? <p className="mt-2 text-red-700">停止理由: {seller.suspension_reason_code}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          {seller.status !== "eligible" ? <form action={updateExternalSellerStatusAction}>
            <input type="hidden" name="profileId" value={seller.profile_id} /><input type="hidden" name="status" value="eligible" />
            <PendingSubmitButton className="button" pendingLabel="承認中…">出品者として承認</PendingSubmitButton>
          </form> : null}
          {seller.status !== "suspended" ? <form action={updateExternalSellerStatusAction} className="flex gap-2">
            <input type="hidden" name="profileId" value={seller.profile_id} /><input type="hidden" name="status" value="suspended" />
            <input className="field" name="reasonCode" placeholder="suspension_reason_code" pattern="[a-z0-9][a-z0-9._-]{0,63}" required />
            <PendingSubmitButton className="button-secondary" pendingLabel="停止中…">出品者利用を停止</PendingSubmitButton>
          </form> : null}
        </div>
      </article>)}{!sellers?.length ? <p className="text-stone-600">規約同意済みの出品者候補はいません。</p> : null}</div>
    </section>
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">作品の審査</h2>
      <div className="mt-3 grid gap-5">{(data ?? []).map((submission) => <section className="panel" key={submission.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{submission.title}</h2><p className="mt-1 text-stone-600">{submission.age_rating} / {submission.status} / {submission.asking_price === null ? "価格未設定" : `${submission.asking_price.toLocaleString("ja-JP")} 円`}</p></div>
      <Link className="text-emerald-700" href={`/dashboard/external-submissions/${submission.id}`}>応募画面</Link></div>
      <p className="mt-3 whitespace-pre-wrap">{submission.description || "説明なし"}</p>
      {submission.review_reason_code ? <p className="mt-2 text-red-700">理由: {submission.review_reason_code}</p> : null}
      {submission.status === "submitted" ? <form action={reviewExternalSubmissionAction} className="mt-4">
        <input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="decision" value="in_review" />
        <PendingSubmitButton className="button" pendingLabel="開始中…">審査を開始</PendingSubmitButton>
      </form> : null}
      {submission.status === "submitted" || submission.status === "in_review" ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <form action={reviewExternalSubmissionAction}><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="decision" value="approved" /><PendingSubmitButton className="button" pendingLabel="承認中…">固定版と停止中商品を作成し承認</PendingSubmitButton></form>
        <form action={reviewExternalSubmissionAction} className="flex gap-2"><input type="hidden" name="submissionId" value={submission.id} /><input type="hidden" name="decision" value="rejected" /><input className="field" name="reasonCode" placeholder="reason_code" pattern="[a-z0-9][a-z0-9._-]{0,63}" required /><PendingSubmitButton className="button" pendingLabel="差戻し中…">差し戻す</PendingSubmitButton></form>
      </div> : null}
      {submission.status === "approved" || submission.status === "published" ? <form action={stopExternalListingAction} className="mt-4 flex gap-2"><input type="hidden" name="submissionId" value={submission.id} /><input className="field" name="reasonCode" placeholder="stop_reason_code" pattern="[a-z0-9][a-z0-9._-]{0,63}" required /><PendingSubmitButton className="button" pendingLabel="停止中…">管理者停止</PendingSubmitButton></form> : null}
    </section>)}{!data?.length ? <p className="text-stone-600">審査対象はありません。</p> : null}</div>
    </section>
  </main>;
}
