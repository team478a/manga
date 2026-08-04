import Link from "next/link";
import { createCloudProjectAction } from "@/app/creator/actions";
import { requireProfile } from "@/lib/auth";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export default async function NewCloudProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;
  return (
    <main className="page max-w-3xl">
      <Link className="text-leaf underline" href="/creator">
        ← クラウド制作へ戻る
      </Link>
      <h1 className="mt-4 text-3xl font-bold">新しい作品</h1>
      <p className="mt-2 text-lg text-stone-600">
        タイトルと基本設定を入力してください。第1話と1ページ目は自動で作られます。
      </p>
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {params.error}
        </p>
      ) : null}
      <form action={createCloudProjectAction} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="title">
            作品名
          </label>
          <input
            className="field"
            id="title"
            name="title"
            maxLength={200}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="label" htmlFor="description">
            説明
          </label>
          <textarea
            className="field min-h-28"
            id="description"
            name="description"
            maxLength={5000}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ageRating">
              対象年齢
            </label>
            <select className="field" id="ageRating" name="ageRating">
              <option>全年齢</option>
              <option>12歳以上</option>
              <option>15歳以上</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="readingDirection">
              綴じ方向
            </label>
            <select
              className="field"
              id="readingDirection"
              name="readingDirection"
            >
              <option value="rtl">右綴じ</option>
              <option value="ltr">左綴じ</option>
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="label">ページ設定</legend>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <label>
              幅
              <input
                className="field"
                name="width"
                type="number"
                min="100"
                max="20000"
                defaultValue="1600"
                required
              />
            </label>
            <label>
              高さ
              <input
                className="field"
                name="height"
                type="number"
                min="100"
                max="20000"
                defaultValue="2400"
                required
              />
            </label>
            <label>
              DPI
              <input
                className="field"
                name="dpi"
                type="number"
                min="72"
                max="1200"
                defaultValue="300"
                required
              />
            </label>
          </div>
        </fieldset>
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-950">
          成人向けへ変更することはできません。成人向け制作にはDesktop
          Adultを使用してください。
        </p>
        <PendingSubmitButton className="button w-full" pendingLabel="作品を作成中…">
          作品を作成
        </PendingSubmitButton>
      </form>
    </main>
  );
}
