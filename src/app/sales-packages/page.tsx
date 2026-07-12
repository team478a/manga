import Link from "next/link";
import { Download, FileText, Sparkles } from "lucide-react";
import { exportSalesPackageAction, generateSalesTextAction, saveSalesPackageAction } from "@/app/sales-packages/actions";
import { getProjectDir, getSalesPackage, isLegacyLocalSalesEnabled, listGeneratedImages } from "@/lib/local/salesPackage";

export default async function SalesPackagesPage({
  searchParams
}: {
  searchParams: Promise<{ projectId?: string; packageId?: string; message?: string; error?: string }>;
}) {
  if (!isLegacyLocalSalesEnabled()) {
    return (
      <main className="page max-w-2xl">
        <section className="panel">
          <p className="text-lg font-semibold text-leaf">MANGAI Desktopへ移行しました</p>
          <h1 className="mt-3 text-3xl font-bold">販売準備・ローカルファイル操作</h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-600">公開WebからPC内のファイルを操作しないため、この旧機能は既定で無効です。MANGAI Desktopの書き出し機能へ段階的に移行します。</p>
          <Link className="button-secondary mt-6" href="/">トップへ戻る</Link>
        </section>
      </main>
    );
  }
  const params = await searchParams;
  const projectId = params.projectId || "default";
  const record = await getSalesPackage(projectId, params.packageId);
  const generatedImages = await listGeneratedImages(projectId);

  return (
    <main className="page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-leaf">ローカル版</p>
          <h1 className="text-3xl font-bold">販売用パッケージ作成</h1>
          <p className="mt-2 text-lg leading-relaxed text-stone-600">
            販売サイトへ手動で出品しやすいよう、説明文・画像・PDF・ZIPをプロジェクトごとにまとめます。
          </p>
        </div>
        <Link className="button-secondary" href="/">
          トップへ戻る
        </Link>
      </div>

      {params.message ? <p className="mt-5 rounded-md bg-green-50 p-4 text-green-800">{params.message}</p> : null}
      {params.error ? <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">{params.error}</p> : null}

      <form className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]" encType="multipart/form-data">
        <input name="packageId" type="hidden" value={record?.id ?? ""} />

        <section className="panel space-y-5">
          <h2 className="text-2xl font-bold">作品情報</h2>
          <div>
            <label className="label" htmlFor="projectId">プロジェクトID</label>
            <p className="mt-1 text-base text-stone-600">半角英数字がおすすめです。保存先フォルダ名になります。</p>
            <input className="field" id="projectId" name="projectId" defaultValue={record?.project_id ?? projectId} required />
            <p className="mt-2 text-sm text-stone-500">現在のプロジェクトフォルダ: {getProjectDir(projectId)}</p>
          </div>
          <div>
            <label className="label" htmlFor="title">作品タイトル</label>
            <input className="field" id="title" name="title" defaultValue={record?.title ?? ""} required />
          </div>
          <div>
            <label className="label" htmlFor="subtitle">サブタイトル</label>
            <input className="field" id="subtitle" name="subtitle" defaultValue={record?.subtitle ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="genre">ジャンル</label>
            <input className="field" id="genre" name="genre" defaultValue={record?.genre ?? ""} placeholder="例：ファンタジー、恋愛、日常" />
          </div>
          <div>
            <label className="label" htmlFor="tags">タグ</label>
            <p className="mt-1 text-base text-stone-600">カンマ、読点、改行で区切れます。</p>
            <textarea className="field min-h-24" id="tags" name="tags" defaultValue={record?.tags.join(", ") ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ageRating">対象年齢</label>
              <select className="field" id="ageRating" name="ageRating" defaultValue={record?.age_rating ?? "全年齢"}>
                <option value="全年齢">全年齢</option>
                <option value="12歳以上">12歳以上</option>
                <option value="15歳以上">15歳以上</option>
                <option value="成人向け">成人向け</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="priceNote">価格メモ</label>
              <input className="field" id="priceNote" name="priceNote" defaultValue={record?.price_note ?? ""} placeholder="例：500円予定" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="salesSites">販売予定サイト</label>
            <input className="field" id="salesSites" name="salesSites" defaultValue={record?.sales_sites ?? ""} placeholder="例：BOOTH、DLsite、pixivFANBOX" />
          </div>
        </section>

        <section className="panel space-y-5">
          <h2 className="text-2xl font-bold">表紙・サムネイル</h2>
          <div>
            <label className="label" htmlFor="coverImage">表紙画像を登録</label>
            <input className="field" id="coverImage" name="coverImage" type="file" accept="image/jpeg,image/png,image/webp" />
            {record?.cover_image_path ? <p className="mt-2 text-sm text-stone-600">登録済み: {record.cover_image_path}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="coverGeneratedPath">生成済み画像から表紙を選ぶ</label>
            <select className="field" id="coverGeneratedPath" name="coverGeneratedPath" defaultValue="">
              <option value="">選択しない</option>
              {generatedImages.map((image) => (
                <option key={`cover-${image.path}`} value={image.path}>
                  {image.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="coverExternalPath">外部画像パスを読み込む</label>
            <p className="mt-1 text-base text-stone-600">安全のため Documents/MANGAI 内の画像だけ読み込めます。</p>
            <input className="field" id="coverExternalPath" name="coverExternalPath" placeholder="Documents/MANGAI 内の画像パス" />
          </div>

          <div className="border-t border-stone-200 pt-5">
            <label className="label" htmlFor="thumbnailImage">サムネイル画像を登録</label>
            <input className="field" id="thumbnailImage" name="thumbnailImage" type="file" accept="image/jpeg,image/png,image/webp" />
            {record?.thumbnail_image_path ? <p className="mt-2 text-sm text-stone-600">登録済み: {record.thumbnail_image_path}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="thumbnailGeneratedPath">生成済み画像からサムネイルを選ぶ</label>
            <select className="field" id="thumbnailGeneratedPath" name="thumbnailGeneratedPath" defaultValue="">
              <option value="">選択しない</option>
              {generatedImages.map((image) => (
                <option key={`thumbnail-${image.path}`} value={image.path}>
                  {image.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="thumbnailExternalPath">外部サムネイル画像パス</label>
            <input className="field" id="thumbnailExternalPath" name="thumbnailExternalPath" placeholder="Documents/MANGAI 内の画像パス" />
          </div>
        </section>

        <section className="panel space-y-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">販売文</h2>
            <button className="button-secondary" formAction={generateSalesTextAction} type="submit">
              <Sparkles className="mr-2 h-5 w-5" />
              販売文案を作成
            </button>
          </div>
          <div>
            <label className="label" htmlFor="catchCopy">キャッチコピー</label>
            <input className="field" id="catchCopy" name="catchCopy" defaultValue={record?.catch_copy ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="salesDescription">販売用説明文</label>
            <textarea className="field min-h-40" id="salesDescription" name="salesDescription" defaultValue={record?.sales_description ?? ""} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="shortIntro">短い紹介文</label>
              <textarea className="field min-h-28" id="shortIntro" name="shortIntro" defaultValue={record?.short_intro ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="thumbnailText">サムネイル文言案</label>
              <textarea className="field min-h-28" id="thumbnailText" name="thumbnailText" defaultValue={record?.thumbnail_text ?? ""} />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="snsPost">SNS告知文</label>
              <textarea className="field min-h-36" id="snsPost" name="snsPost" defaultValue={record?.sns_post ?? ""} />
            </div>
            <div>
              <label className="label" htmlFor="notice">注意書き</label>
              <p className="mt-1 text-base text-stone-600">対象年齢が成人向けの場合、必要な注意書きを自動追加します。</p>
              <textarea className="field min-h-36" id="notice" name="notice" defaultValue={record?.notice ?? ""} />
            </div>
          </div>
        </section>

        <section className="panel space-y-5 lg:col-span-2">
          <h2 className="text-2xl font-bold">書き出し用ファイル</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="label" htmlFor="mainPdf">本編PDF</label>
              <input className="field" id="mainPdf" name="mainPdf" type="file" accept="application/pdf" />
            </div>
            <div>
              <label className="label" htmlFor="bodyImages">本編画像ZIPに入れる画像</label>
              <input className="field" id="bodyImages" name="bodyImages" type="file" accept="image/jpeg,image/png,image/webp" multiple />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button className="button" formAction={saveSalesPackageAction} type="submit">
              <FileText className="mr-2 h-5 w-5" />
              保存
            </button>
            <button className="button-secondary" formAction={exportSalesPackageAction} type="submit">
              <Download className="mr-2 h-5 w-5" />
              販売用ファイルを書き出す
            </button>
          </div>
        </section>
      </form>
    </main>
  );
}
