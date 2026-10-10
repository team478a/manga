import Link from "next/link";
import { notFound } from "next/navigation";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startExternalSubmissionUploadAction } from "../actions";
import { ExternalSubmissionUploadClient } from "./ExternalSubmissionUploadClient";

export default async function ExternalSubmissionPage({
  params, searchParams,
}: { params: Promise<{ submissionId: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireProfile();
  const { submissionId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: submission } = await supabase.from("external_work_submissions")
    .select("id,title,description,status,source_format,age_rating").eq("id", submissionId).maybeSingle();
  if (!submission) notFound();
  const [{ data: files }, { data: rawPages }, { data: job }] = await Promise.all([
    supabase.from("external_work_submission_files").select("id,original_name,validation_status,error_code").eq("submission_id", submissionId),
    supabase.from("external_work_submission_pages").select("id,position,storage_path").eq("submission_id", submissionId).order("position"),
    supabase.from("external_submission_ingest_jobs").select("status,attempt_count,error_code").eq("submission_id", submissionId).maybeSingle(),
  ]);
  const pages = (await Promise.all((rawPages ?? []).map(async (page) => {
    const signed = await supabase.storage.from("external-submission-pages").createSignedUrl(page.storage_path, 300);
    return signed.data?.signedUrl
      ? { id: page.id, position: page.position, url: signed.data.signedUrl }
      : null;
  }))).filter((page): page is { id: string; position: number; url: string } => page !== null);
  return <main className="page max-w-5xl">
    <Link className="text-emerald-700" href="/dashboard/external-submissions">← 応募一覧</Link>
    <h1 className="mt-4 text-3xl font-bold">{submission.title}</h1>
    <p className="mt-2 text-stone-600">{submission.age_rating} / {submission.source_format} / 状態: {submission.status}</p>
    {query.error ? <InlineErrorMessage>{query.error}</InlineErrorMessage> : null}
    {submission.status === "draft" ? <form action={startExternalSubmissionUploadAction} className="panel mt-6">
      <input type="hidden" name="submissionId" value={submission.id} />
      <p>開始後のファイルは非公開のquarantineに保存されます。</p>
      <PendingSubmitButton className="button mt-4" pendingLabel="準備中…">Uploadを開始</PendingSubmitButton>
    </form> : null}
    <div className="mt-6"><ExternalSubmissionUploadClient submissionId={submission.id}
      sourceFormat={submission.source_format} status={submission.status} pages={pages} /></div>
    <section className="panel mt-6"><h2 className="text-xl font-semibold">検証状況</h2>
      <p className="mt-2">Job: {job?.status ?? "未開始"}{job?.error_code ? ` (${job.error_code})` : ""}</p>
      <ul className="mt-2 list-disc pl-6">{(files ?? []).map((file) => <li key={file.id}>{file.original_name}: {file.validation_status}{file.error_code ? ` (${file.error_code})` : ""}</li>)}</ul>
    </section>
  </main>;
}
