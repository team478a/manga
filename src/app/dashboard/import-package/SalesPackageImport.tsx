"use client";

import React from "react";
import JSZip from "jszip";
import {
  parseSalesPackageManifest,
  type SalesPackageManifest,
} from "@mangai/export-core";

const MAX_PACKAGE_BYTES = 250 * 1024 * 1024;
const MAX_EXPANDED_BYTES = 500 * 1024 * 1024;
const MAX_ENTRY_BYTES = 250 * 1024 * 1024;

type VerifiedFile = SalesPackageManifest["files"][number] & {
  verified: true;
};
type ImportPreview = {
  manifest: SalesPackageManifest;
  files: VerifiedFile[];
  coverUrl?: string;
  sampleUrls: string[];
};
type SizedZipEntry = JSZip.JSZipObject & {
  _data?: { uncompressedSize?: number };
};

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function formatBytes(value: number) {
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function roleLabel(role: VerifiedFile["role"]) {
  return (
    {
      product_pdf: "商品PDF",
      page_images_zip: "連番画像ZIP",
      cover: "表紙",
      sample: "サンプル",
      project_info: "作品情報",
      description: "販売説明文",
      social_post: "SNS告知文",
    } as const
  )[role];
}

export function SalesPackageImport() {
  const [preview, setPreview] = React.useState<ImportPreview | null>(null);
  const [error, setError] = React.useState("");
  const [checking, setChecking] = React.useState(false);
  const urls = React.useRef<string[]>([]);

  const clearUrls = React.useCallback(() => {
    urls.current.forEach((url) => URL.revokeObjectURL(url));
    urls.current = [];
  }, []);
  React.useEffect(() => clearUrls, [clearUrls]);

  const inspect = async (file: File) => {
    clearUrls();
    setPreview(null);
    setError("");
    if (file.size > MAX_PACKAGE_BYTES)
      throw new Error("販売パッケージは250MB以内にしてください。");
    if (!file.name.toLowerCase().endsWith(".zip"))
      throw new Error("MANGAI Desktopが生成したZIPを選んでください。");

    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const manifestEntry = zip.file("manifest.json");
    if (!manifestEntry) throw new Error("manifest.jsonがありません。");
    const manifestText = await manifestEntry.async("string");
    if (new TextEncoder().encode(manifestText).byteLength > 1024 * 1024)
      throw new Error("manifest.jsonが大きすぎます。");
    let manifestValue: unknown;
    try {
      manifestValue = JSON.parse(manifestText);
    } catch {
      throw new Error("manifest.jsonを読み取れません。");
    }
    const manifest = parseSalesPackageManifest(manifestValue);
    const declaredPaths = new Set(manifest.files.map((entry) => entry.path));
    const entries = Object.values(zip.files);
    if (
      entries.some(
        (entry) =>
          entry.unsafeOriginalName && entry.unsafeOriginalName !== entry.name,
      )
    )
      throw new Error("危険な相対パスを含むZIPは読み込めません。");
    const actualPaths = entries
      .filter((entry) => !entry.dir && entry.name !== "manifest.json")
      .map((entry) => entry.name);
    if (
      actualPaths.length !== declaredPaths.size ||
      actualPaths.some((path) => !declaredPaths.has(path))
    )
      throw new Error("manifestにないファイル、または不足ファイルがあります。");
    const expandedBytes = manifest.files.reduce(
      (total, entry) => total + entry.byteSize,
      0,
    );
    if (expandedBytes > MAX_EXPANDED_BYTES)
      throw new Error("展開後の合計サイズが500MBを超えています。");

    const verified: VerifiedFile[] = [];
    let coverUrl: string | undefined;
    const sampleUrls: string[] = [];
    for (const declared of manifest.files) {
      if (declared.byteSize > MAX_ENTRY_BYTES)
        throw new Error(`${declared.path}が250MBを超えています。`);
      const entry = zip.file(declared.path);
      if (!entry) throw new Error(`${declared.path}がありません。`);
      const centralDirectorySize = (entry as SizedZipEntry)._data
        ?.uncompressedSize;
      if (
        !Number.isSafeInteger(centralDirectorySize) ||
        centralDirectorySize !== declared.byteSize
      )
        throw new Error(`${declared.path}の展開サイズが一致しません。`);
      const bytes = await entry.async("uint8array");
      if (bytes.byteLength !== declared.byteSize)
        throw new Error(`${declared.path}のサイズが一致しません。`);
      const digest = hex(
        await crypto.subtle.digest("SHA-256", bytes.slice().buffer),
      );
      if (digest !== declared.sha256)
        throw new Error(`${declared.path}のSHA-256が一致しません。`);
      verified.push({ ...declared, verified: true });
      if (declared.role === "cover" || declared.role === "sample") {
        const url = URL.createObjectURL(
          new Blob([bytes.slice()], { type: declared.mimeType }),
        );
        urls.current.push(url);
        if (declared.role === "cover") coverUrl = url;
        else sampleUrls.push(url);
      }
    }
    setPreview({ manifest, files: verified, coverUrl, sampleUrls });
  };

  return (
    <section className="mt-7 space-y-6">
      <div className="panel">
        <label className="label" htmlFor="salesPackage">
          MANGAI販売パッケージZIP
        </label>
        <p className="mt-1 text-base text-stone-600">
          最大250MB。検証はこのブラウザ内で行われます。
        </p>
        <input
          className="field mt-4"
          id="salesPackage"
          type="file"
          accept="application/zip,.zip"
          disabled={checking}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setChecking(true);
            void inspect(file)
              .catch((cause) => {
                clearUrls();
                setPreview(null);
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "販売パッケージを確認できませんでした。",
                );
              })
              .finally(() => setChecking(false));
          }}
        />
        {checking ? (
          <p className="mt-4 rounded-md bg-amber-50 p-4 text-amber-900">
            ファイル構成とSHA-256を確認しています…
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md bg-red-50 p-4 text-red-700">{error}</p>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="rounded-md bg-green-50 p-5 text-green-900">
            <h2 className="text-xl font-bold">検証に成功しました</h2>
            <p className="mt-2">
              {preview.files.length}
              ファイルすべての容量とSHA-256が一致しています。
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <section className="panel">
              <h2 className="text-2xl font-bold">作品情報</h2>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-stone-600">作品名</dt>
                  <dd className="mt-1 text-lg">
                    {preview.manifest.work.title}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-600">ジャンル</dt>
                  <dd className="mt-1 text-lg">
                    {preview.manifest.work.genre || "未設定"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-600">ページ</dt>
                  <dd className="mt-1 text-lg">
                    {preview.manifest.work.pageCount}ページ /{" "}
                    {preview.manifest.work.episodeCount}話
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-stone-600">対象年齢</dt>
                  <dd className="mt-1 text-lg">
                    {preview.manifest.work.ageRating}
                  </dd>
                </div>
              </dl>
              {preview.manifest.work.description ? (
                <p className="mt-5 whitespace-pre-wrap leading-relaxed text-stone-700">
                  {preview.manifest.work.description}
                </p>
              ) : null}
            </section>
            <section className="panel">
              <h2 className="text-2xl font-bold">表紙</h2>
              {preview.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="mt-4 max-h-96 w-full rounded-md bg-stone-100 object-contain"
                  src={preview.coverUrl}
                  alt="販売パッケージの表紙"
                />
              ) : (
                <p className="mt-4 text-stone-600">表紙は含まれていません。</p>
              )}
            </section>
          </div>
          {preview.sampleUrls.length ? (
            <section className="panel">
              <h2 className="text-2xl font-bold">公開サンプル候補</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {preview.sampleUrls.map((url, index) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="max-h-96 w-full rounded-md bg-stone-100 object-contain"
                    src={url}
                    alt={`サンプル${index + 1}`}
                    key={url}
                  />
                ))}
              </div>
            </section>
          ) : null}
          <section className="panel overflow-x-auto">
            <h2 className="text-2xl font-bold">収録ファイル</h2>
            <table className="mt-5 w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="p-3">用途</th>
                  <th className="p-3">パス</th>
                  <th className="p-3">サイズ</th>
                  <th className="p-3">検証</th>
                </tr>
              </thead>
              <tbody>
                {preview.files.map((file) => (
                  <tr className="border-b border-stone-200" key={file.path}>
                    <td className="p-3">{roleLabel(file.role)}</td>
                    <td className="p-3 font-mono text-sm">{file.path}</td>
                    <td className="p-3">{formatBytes(file.byteSize)}</td>
                    <td className="p-3 font-semibold text-green-700">一致</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <div className="rounded-md border border-amber-300 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-xl font-bold">次の段階</h2>
            <p className="mt-2 leading-relaxed">
              パッケージ内容は正常です。次の実装で、確認した内容から非公開の作品下書きと停止中の商品を作成できるようにします。
            </p>
          </div>
        </>
      ) : null}
    </section>
  );
}
