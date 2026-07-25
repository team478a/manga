import { createWork } from "@/app/actions";
import { requireProfile } from "@/lib/auth";
import { CREATOR_INPUT_LIMITS } from "@/lib/creator-input";

export default async function NewWorkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireProfile();
  const params = await searchParams;

  return (
    <main className="page max-w-3xl">
      <h1 className="text-3xl font-bold">作品アップロード</h1>
      <p className="mt-3 text-lg text-stone-600">
        まずは下書き保存でも大丈夫です。公開チェックを入れると一覧に表示されます。
      </p>
      <p className="mt-3 rounded-md bg-amber-50 p-4 text-amber-900">
        MANGAI Cloudで登録できるのは一般漫画だけです。成人向け作品はMANGAI
        Desktop Adultで管理してください。
      </p>
      {params.error ? (
        <p className="mt-5 rounded-md bg-red-50 p-4 text-red-700">
          {params.error}
        </p>
      ) : null}
      <form action={createWork} className="panel mt-6 space-y-5">
        <div>
          <label className="label" htmlFor="title">
            作品名
          </label>
          <p className="mt-1 text-base text-stone-600">
            作品ページの一番上に表示されます。
          </p>
          <input
            className="field"
            id="title"
            name="title"
            maxLength={CREATOR_INPUT_LIMITS.workTitle}
            required
            placeholder="例：春の庭で待つ少女"
          />
        </div>
        <div>
          <label className="label" htmlFor="description">
            作品説明
          </label>
          <p className="mt-1 text-base text-stone-600">
            制作意図や見てほしいところを、短い文章で書けます。
          </p>
          <textarea
            className="field min-h-36"
            id="description"
            name="description"
            maxLength={CREATOR_INPUT_LIMITS.workDescription}
            placeholder="例：やさしい朝の光をイメージして制作しました。"
          />
        </div>
        <div>
          <label className="label" htmlFor="image">
            作品画像
          </label>
          <p className="mt-1 text-base text-stone-600">
            JPG、PNG、WebPに対応しています。10MB以内の画像を選んでください。
          </p>
          <input
            className="field"
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="tags">
            タグ
          </label>
          <p className="mt-1 text-base text-stone-600">
            カンマで区切ると複数登録できます。
          </p>
          <input
            className="field"
            id="tags"
            name="tags"
            maxLength={
              CREATOR_INPUT_LIMITS.tagCount *
              (CREATOR_INPUT_LIMITS.tagLength + 1)
            }
            placeholder="癒し, 花, ファンタジー"
          />
        </div>
        <fieldset>
          <legend className="label">公開設定</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input
                className="mt-1 h-5 w-5"
                name="visibility"
                type="radio"
                value="private"
                defaultChecked
              />
              <span>
                <span className="block text-lg font-semibold">
                  非公開で保存
                </span>
                <span className="mt-1 block text-base text-stone-600">
                  あとで見直してから公開できます。
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-stone-300 p-4">
              <input
                className="mt-1 h-5 w-5"
                name="visibility"
                type="radio"
                value="public"
              />
              <span>
                <span className="block text-lg font-semibold">公開する</span>
                <span className="mt-1 block text-base text-stone-600">
                  公開作品一覧に表示されます。
                </span>
              </span>
            </label>
          </div>
        </fieldset>
        <button className="button w-full" type="submit">
          保存する
        </button>
      </form>
    </main>
  );
}
