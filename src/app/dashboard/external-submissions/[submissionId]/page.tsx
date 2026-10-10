import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  publishExternalMarketplaceListingAction,
  startExternalSubmissionUploadAction,
  submitExternalWorkForReviewAction,
  withdrawExternalMarketplaceListingAction,
} from "../actions";
import { ExternalSubmissionUploadClient } from "./ExternalSubmissionUploadClient";

export default async function ExternalSubmissionPage({
  params, searchParams,
}: { params: Promise<{ submissionId: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireProfile();
  const { submissionId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: submission } = await supabase.from("external_work_submissions")
    .select("id,title,description,status,source_format,age_rating,asking_price,review_reason_code").eq("id", submissionId).maybeSingle();
  if (!submission) notFound();
  const [{ data: files }, { data: rawPages }, { data: job }, { data: notifications }] = await Promise.all([
    supabase.from("external_work_submission_files").select("id,original_name,validation_status,error_code").eq("submission_id", submissionId),
    supabase.from("external_work_submission_pages").select("id,position,storage_path,is_sample").eq("submission_id", submissionId).order("position"),
    supabase.from("external_submission_ingest_jobs").select("status,attempt_count,error_code").eq("submission_id", submissionId).maybeSingle(),
    supabase.from("external_submission_notifications").select("id,notification_type,reason_code,created_at").eq("submission_id", submissionId).order("created_at", { ascending: false }).limit(10),
  ]);
  const pages = (await Promise.all((rawPages ?? []).map(async (page) => {
    const signed = await supabase.storage.from("external-submission-pages").createSignedUrl(page.storage_path, 300);
    return signed.data?.signedUrl
      ? { id: page.id, position: page.position, url: signed.data.signedUrl, isSample: page.is_sample }
      : null;
  }))).filter((page): page is { id: string; position: number; url: string; isSample: boolean } => page !== null);
  return <main className="page max-w-5xl">
    <Link className="text-emerald-700" href="/dashboard/external-submissions">← 応募一覧</Link>
    <h1 className="mt-4 text-3xl font-bold">{submission.title}</h1>
    <p className="mt-2 text-stone-600">{submission.age_rating} / {submission.source_format} / 状態: {submission.status}</p>
    {submission.asking_price !== null ? <p className="mt-1 text-stone-600">申請価格: {submission.asking_price.toLocaleString("ja-JP")} 円</p> : null}
    {submission.review_reason_code ? <p className="mt-1 text-red-700">理由コード: {submission.review_reason_code}</p> : null}
    {query.error ? <InlineErrorMessage>{query.error}</InlineErrorMessage> : null}
    {submission.status === "draft" ? <form action={startExternalSubmissionUploadAction} className="panel mt-6">
      <input type="hidden" name="submissionId" value={submission.id} />
      <p>開始後のファイルは非公開のquarantineに保存されます。</p>
      <PendingSubmitButton className="button mt-4" pendingLabel="準備中…">Uploadを開始</PendingSubmitButton>
    </form> : null}
    <div className="mt-6"><ExternalSubmissionUploadClient submissionId={submission.id}
      sourceFormat={submission.source_format} status={submission.status} pages={pages} /></div>
    {submission.status === "ready" || submission.status === "rejected" ? <form action={submitExternalWorkForReviewAction} className="panel mt-6 space-y-4">
      <h2 className="text-xl font-semibold">審査へ提出</h2>
      <input type="hidden" name="submissionId" value={submission.id} />
      <div><label className="label" htmlFor="price">販売価格（円）</label><input className="field" id="price" name="price" type="number" min="0" step="1" defaultValue={submission.asking_price ?? 100} required /></div>
      <label className="flex gap-2"><input name="rightsHolderConfirmed" type="checkbox" required />自分が権利者または出品に必要な権限を持っています。</label>
      <label className="flex gap-2"><input name="thirdPartyPermissionsConfirmed" type="checkbox" required />第三者素材の必要な許諾を確認しました。</label>
      <label className="flex gap-2"><input name="aiUseDisclosed" type="checkbox" required />AI利用に関する申告内容に虚偽はありません。</label>
      <label className="flex gap-2"><input name="adultContentAbsent" type="checkbox" required />成人向け内容を含まない一般向け作品です。</label>
      <PendingSubmitButton className="button" pendingLabel="提出中…">審査へ提出</PendingSubmitButton>
    </form> : null}
    {submission.status === "approved" ? <form action={publishExternalMarketplaceListingAction} className="panel mt-6">
      <input type="hidden" name="submissionId" value={submission.id} /><p>承認済みの固定版と申請価格で公開します。公開後の差し替えはできません。</p>
      <PendingSubmitButton className="button mt-4" pendingLabel="公開中…">作品を公開し販売を開始</PendingSubmitButton>
    </form> : null}
    {submission.status === "published" ? <form action={withdrawExternalMarketplaceListingAction} className="panel mt-6">
      <input type="hidden" name="submissionId" value={submission.id} /><p>新規販売と公開を停止します。購入済みの読書権限は維持されます。</p>
      <PendingSubmitButton className="button mt-4" pendingLabel="停止中…">販売と公開を停止</PendingSubmitButton>
    </form> : null}
    <section className="panel mt-6"><h2 className="text-xl font-semibold">検証状況</h2>
      <p className="mt-2">Job: {job?.status ?? "未開始"}{job?.error_code ? ` (${job.error_code})` : ""}</p>
      <ul className="mt-2 list-disc pl-6">{(files ?? []).map((file) => <li key={file.id}>{file.original_name}: {file.validation_status}{file.error_code ? ` (${file.error_code})` : ""}</li>)}</ul>
    </section>
    <section className="panel mt-6"><h2 className="text-xl font-semibold">審査・公開のお知らせ</h2>
      <ul className="mt-2 list-disc pl-6">{(notifications ?? []).map((notification) => <li key={notification.id}>
        {notification.notification_type}{notification.reason_code ? ` (${notification.reason_code})` : ""}
      </li>)}</ul>
      {!notifications?.length ? <p className="mt-2 text-stone-600">お知らせはありません。</p> : null}
    </section>
  </main>;
}
