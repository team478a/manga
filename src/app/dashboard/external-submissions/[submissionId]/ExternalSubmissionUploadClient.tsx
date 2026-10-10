"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type Page = { id: string; position: number; url: string; isSample: boolean };

export function ExternalSubmissionUploadClient({
  submissionId,
  sourceFormat,
  status,
  pages: initialPages,
}: {
  submissionId: string;
  sourceFormat: "pdf" | "zip" | "images";
  status: string;
  pages: Page[];
}) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (sourceFormat !== "images" && files.length !== 1) {
      setMessage("PDFまたはZIPは1ファイルだけ選んでください。");
      return;
    }
    setBusy(true); setMessage("");
    try {
      for (const file of Array.from(files)) {
        const body = new FormData(); body.set("file", file);
        const response = await fetch(`/api/creator/external-submissions/${submissionId}/uploads`, { method: "POST", body });
        if (!response.ok) throw new Error("upload_failed");
      }
      setMessage("隔離領域へ保存しました。検証を開始してください。");
      router.refresh();
    } catch { setMessage("Uploadに失敗しました。"); } finally { setBusy(false); }
  }

  async function validate() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/creator/external-submissions/${submissionId}/validation`, { method: "POST" });
      if (!response.ok) throw new Error("validation_failed");
      setMessage("検証待ちに追加しました。"); router.refresh();
    } catch { setMessage("検証を開始できませんでした。"); } finally { setBusy(false); }
  }

  async function move(index: number, offset: number) {
    const target = index + offset; if (target < 0 || target >= pages.length) return;
    const reordered = [...pages]; [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    const response = await fetch(`/api/creator/external-submissions/${submissionId}/pages/order`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageIds: reordered.map((page) => page.id) }),
    });
    if (response.ok) setPages(reordered.map((page, position) => ({ ...page, position: position + 1 })));
    else setMessage("ページ順を保存できませんでした。");
    setBusy(false);
  }

  async function saveSamples() {
    const pageIds = pages.filter((page) => page.isSample).map((page) => page.id);
    setBusy(true); setMessage("");
    const response = await fetch(`/api/creator/external-submissions/${submissionId}/pages/samples`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ pageIds }),
    });
    setMessage(response.ok ? "試し読みページを保存しました。" : "試し読みページを保存できませんでした。");
    setBusy(false);
  }

  return <div className="space-y-5">
    {status === "uploading" ? <div className="panel space-y-4">
      <label className="label" htmlFor="external-source">原稿ファイル</label>
      <input className="field" id="external-source" type="file" multiple={sourceFormat === "images"}
        accept={sourceFormat === "pdf" ? "application/pdf" : sourceFormat === "zip" ? "application/zip,.zip" : "image/png,image/jpeg,image/webp"}
        disabled={busy} onChange={(event) => void upload(event.target.files)} />
      <button className="button" type="button" disabled={busy} onClick={() => void validate()}>検証を開始</button>
    </div> : null}
    {message ? <p className="rounded-md bg-stone-100 p-3" role="status">{message}</p> : null}
    {pages.length ? <><div className="grid gap-3 sm:grid-cols-2">
      {pages.map((page, index) => <div className="panel" key={page.id}>
        <Image alt={`ページ ${index + 1}`} className="mx-auto h-auto max-h-72 w-auto" src={page.url} width={320} height={480} unoptimized />
        <div className="mt-3 flex items-center justify-between"><span>{index + 1}ページ</span><span className="flex gap-2">
          <button className="button-secondary" type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)}>上へ</button>
          <button className="button-secondary" type="button" disabled={busy || index === pages.length - 1} onClick={() => void move(index, 1)}>下へ</button>
        </span></div>
        {status === "ready" || status === "rejected" ? <label className="mt-3 flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" checked={page.isSample} disabled={busy}
            onChange={(event) => setPages((current) => current.map((item) => item.id === page.id ? { ...item, isSample: event.target.checked } : item))} />
          試し読みに含める
        </label> : null}
      </div>)}
    </div>{status === "ready" || status === "rejected" ? <div className="panel">
      <p className="text-sm text-stone-600">試し読みは1〜10ページを選択してください。2ページ以上の作品では全ページを選べません。</p>
      <button className="button mt-3" type="button" disabled={busy} onClick={() => void saveSamples()}>試し読み設定を保存</button>
    </div> : null}</> : null}
  </div>;
}
