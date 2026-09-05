import Link from "next/link";
import { createCloudResearchReportAction } from "@/app/dashboard/research/actions";
import { InlineErrorMessage } from "@/components/InlineErrorMessage";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { ResearchSubmitButton } from "./research-submit-button";

// OpenAI web search can take close to a minute. Keep the Server Action alive
// long enough to save the completed report and redirect to the result page.
export const maxDuration = 180;

function Field({
  id,
  label,
  children,
  help,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  help?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
      {help ? <p className="mt-2 text-sm text-stone-500">{help}</p> : null}
    </div>
  );
}

export default async function NewCloudResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const enabled = cloudResearchFeatureEnabled();
  if (enabled) await requireProfile();
  const { error } = await searchParams;

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/dashboard/research">
        ← 市場分析履歴へ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">AI市場分析</h1>
      <p className="mt-2 text-stone-600">
        作りたい方向を選ぶだけで、AIが「今、どんな作品が売れやすいか」を調べます。
      </p>
      <p className="mt-4 rounded-lg bg-violet-50 p-4 text-sm text-violet-950" role="status">
        市場、販売先、価格の知識は不要です。現在の需要と競合から、具体的なおすすめを提示します。
      </p>
      {error ? (
        <InlineErrorMessage radius="lg" role="alert">
          {error}
        </InlineErrorMessage>
      ) : null}
      {!enabled ? (
        <div className="panel mt-6" role="status">
          市場分析機能は現在停止中です。
        </div>
      ) : (
        <form action={createCloudResearchReportAction} className="mt-6 space-y-6">
          <section className="panel">
            <input name="contentClass" type="hidden" value="general" />
            <h2 className="text-xl font-bold">作りたい作品を教えてください</h2>
            <p className="mt-2 text-sm text-stone-600">
              まずは2項目だけで分析できます。迷ったら「AIにおまかせ」を選んでください。
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field id="genre" label="ジャンル">
                <select className="field" defaultValue="AIにおまかせ" id="genre" name="genre" required>
                  <option value="AIにおまかせ">AIにおまかせ</option>
                  <option value="ファンタジー">ファンタジー</option>
                  <option value="恋愛">恋愛</option>
                  <option value="異世界">異世界</option>
                  <option value="アクション">アクション</option>
                  <option value="ミステリー・サスペンス">ミステリー・サスペンス</option>
                  <option value="ホラー">ホラー</option>
                  <option value="日常・ヒューマンドラマ">日常・ヒューマンドラマ</option>
                  <option value="コメディ">コメディ</option>
                  <option value="BL">BL</option>
                  <option value="TL">TL</option>
                </select>
              </Field>
              <Field id="theme" label="テーマ・読後感">
                <select className="field" defaultValue="AIにおまかせ" id="theme" name="theme" required>
                  <option value="AIにおまかせ">AIにおまかせ</option>
                  <option value="成長・再出発">成長・再出発</option>
                  <option value="恋愛・関係性">恋愛・関係性</option>
                  <option value="復讐・逆転">復讐・逆転</option>
                  <option value="冒険・探索">冒険・探索</option>
                  <option value="仕事・キャリア">仕事・キャリア</option>
                  <option value="家族・友情">家族・友情</option>
                  <option value="謎解き・事件">謎解き・事件</option>
                  <option value="癒やし・日常">癒やし・日常</option>
                </select>
              </Field>
            </div>
            <div className="mt-5">
              <Field
                id="referenceWorks"
                label="作りたいイメージ（任意）"
                help="雰囲気、主人公、舞台、参考作品など、決まっていることだけ入力してください。"
              >
                <input
                  className="field"
                  id="referenceWorks"
                  maxLength={500}
                  name="referenceWorks"
                  placeholder="例：働く女性が人生をやり直す、読後感は爽快"
                />
              </Field>
            </div>
            <div className="mt-5 rounded-lg border border-violet-200 bg-violet-50 p-4">
              <Field id="pageCount" label="ページ数">
                <select className="field" defaultValue="0" id="pageCount" name="pageCount" required>
                  <option value="0">AIにおまかせ</option>
                  <option value="4">4ページ（短いお試し）</option>
                  <option value="8">8ページ（短編）</option>
                  <option value="16">16ページ</option>
                  <option value="24">24ページ</option>
                  <option value="32">32ページ</option>
                  <option value="48">48ページ</option>
                  <option value="64">64ページ</option>
                  <option value="100">100ページ前後</option>
                </select>
                <p className="mt-2 text-sm text-stone-600">
                  短く試す場合は4ページ、短編を作る場合は8ページを選んでください。
                </p>
              </Field>
            </div>
            <details className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <summary className="cursor-pointer font-bold">
                希望がある場合だけ詳細を設定
              </summary>
              <p className="mt-2 text-sm text-stone-600">
                未定の項目はAIが売れやすさを基準に提案します。
              </p>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Field id="audience" label="届けたい読者">
                  <select className="field" defaultValue="AIにおまかせ" id="audience" name="audience" required>
                    <option value="AIにおまかせ">AIにおまかせ</option>
                    <option value="10代中心">10代中心</option>
                    <option value="20代女性中心">20代女性中心</option>
                    <option value="20代男性中心">20代男性中心</option>
                    <option value="30〜40代女性中心">30〜40代女性中心</option>
                    <option value="30〜40代男性中心">30〜40代男性中心</option>
                    <option value="幅広い一般読者">幅広い一般読者</option>
                    <option value="特定ジャンルのコア読者">特定ジャンルのコア読者</option>
                  </select>
                </Field>
                <Field id="platform" label="販売先">
                  <select className="field" defaultValue="AIにおまかせ" id="platform" name="platform" required>
                    <option value="AIにおまかせ">AIにおまかせ</option>
                    <option value="Amazon Kindle">Amazon Kindle</option>
                    <option value="LINEマンガ">LINEマンガ</option>
                    <option value="ピッコマ">ピッコマ</option>
                    <option value="コミックシーモア">コミックシーモア</option>
                    <option value="Webtoon">Webtoon</option>
                    <option value="BOOTH">BOOTH</option>
                    <option value="複数プラットフォーム">複数プラットフォーム</option>
                  </select>
                </Field>
                <Field id="publicationFormat" label="連載／読切">
                  <select className="field" defaultValue="auto" id="publicationFormat" name="publicationFormat" required>
                    <option value="auto">AIにおまかせ</option>
                    <option value="series">連載</option>
                    <option value="one_shot">読切</option>
                  </select>
                </Field>
                <Field id="priceBand" label="価格帯">
                  <select className="field" defaultValue="auto" id="priceBand" name="priceBand" required>
                    <option value="auto">AIにおまかせ</option>
                    <option value="free">無料</option>
                    <option value="low">100〜499円</option>
                    <option value="standard">500〜999円</option>
                    <option value="premium">1,000〜1,999円</option>
                    <option value="high">2,000円以上</option>
                  </select>
                </Field>
              </div>
            </details>
            <p className="mt-4 text-xs text-stone-500">
              成人向け（AI接続は準備中）の内容は、明示許可なしに外部AIへ送信しません。
            </p>
          </section>
          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
            実行には数十秒かかる場合があります。ボタンを押した後は画面を閉じずにお待ちください。
          </p>
          <ResearchSubmitButton />
        </form>
      )}
    </main>
  );
}
