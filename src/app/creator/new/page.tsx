import Link from "next/link";
import { createCloudProjectAction } from "@/app/creator/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import { requireProfile } from "@/lib/auth";
import { CompletionModeFields } from "./CompletionModeFields";

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
        <InlineErrorMessage>
          {params.error}
        </InlineErrorMessage>
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
        </div>
        <section aria-labelledby="page-settings-heading">
          <h2 id="page-settings-heading" className="label">ページ設定</h2>
          <div className="mt-2"><CompletionModeFields /></div>
        </section>
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
