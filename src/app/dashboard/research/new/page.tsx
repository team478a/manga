import Link from "next/link";
import { createCloudResearchReportAction } from "@/app/dashboard/research/actions";
import { requireProfile } from "@/lib/auth";
import { cloudResearchFeatureEnabled } from "@/lib/cloud-research";
import { parseCloudResearchSearchAdoption } from "@/lib/cloud-research-search";
import { cloudResearchSourceVerificationEnabled } from "@/lib/cloud-research-source-verification";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default async function NewCloudResearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    candidateTitle?: string;
    candidateUrl?: string;
    candidateTopic?: string;
    candidatePublishedAt?: string;
  }>;
}) {
  await requireProfile();
  const {
    error,
    candidateTitle,
    candidateUrl,
    candidateTopic,
    candidatePublishedAt,
  } = await searchParams;
  const adoptedCandidate = parseCloudResearchSearchAdoption({
    title: candidateTitle,
    url: candidateUrl,
    topic: candidateTopic,
    publishedAt: candidatePublishedAt,
  });
  const enabled = cloudResearchFeatureEnabled();
  const sourceVerificationEnabled = cloudResearchSourceVerificationEnabled();
  const now = new Date().toISOString().slice(0, 16);

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/dashboard/research">
        ← 市場分析履歴へ
      </Link>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-bold">新しい市場分析</h1>
        <Link
          className="button-secondary text-center"
          href="/dashboard/research/discover"
        >
          出典候補を探す
        </Link>
      </div>
      <p className="mt-2 text-stone-600">
        確認済みの出典だけを使い、定性的な分析Reportを作成します。
      </p>
      {error ? (
        <p
          className="mt-5 rounded-md bg-red-50 p-4 text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {!enabled ? (
        <div className="panel mt-6" role="status">
          市場分析機能は現在停止中です。
        </div>
      ) : (
        <form action={createCloudResearchReportAction} className="mt-6 space-y-6">
          <section className="panel">
            <h2 className="text-xl font-bold">制作条件</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field id="genre" label="ジャンル">
                <input className="field" id="genre" name="genre" maxLength={80} required />
              </Field>
              <Field id="platform" label="公開プラットフォーム">
                <input className="field" id="platform" name="platform" maxLength={120} required />
              </Field>
              <Field id="contentClass" label="一般／成人向け区分">
                <select className="field" id="contentClass" name="contentClass" required>
                  <option value="general">一般向け</option>
                  <option value="adult">成人向け（Cloud実行対象外）</option>
                </select>
              </Field>
              <Field id="publicationFormat" label="連載／読切">
                <select className="field" id="publicationFormat" name="publicationFormat" required>
                  <option value="series">連載</option>
                  <option value="one_shot">読切</option>
                </select>
              </Field>
              <Field id="priceMin" label="価格帯（下限・円）">
                <input className="field" id="priceMin" name="priceMin" type="number" min={0} max={1000000} defaultValue={0} required />
              </Field>
              <Field id="priceMax" label="価格帯（上限・円）">
                <input className="field" id="priceMax" name="priceMax" type="number" min={0} max={1000000} defaultValue={1000} required />
              </Field>
              <Field id="pageCount" label="ページ数">
                <input className="field" id="pageCount" name="pageCount" type="number" min={1} max={2000} defaultValue={32} required />
              </Field>
            </div>
            <div className="mt-5 space-y-5">
              <Field id="audience" label="想定読者">
                <textarea className="field min-h-24" id="audience" name="audience" maxLength={300} required />
              </Field>
              <Field id="theme" label="テーマ">
                <textarea className="field min-h-24" id="theme" name="theme" maxLength={300} required />
              </Field>
              <Field id="referenceWorks" label="参考作品">
                <textarea className="field min-h-24" id="referenceWorks" name="referenceWorks" maxLength={500} required />
              </Field>
            </div>
          </section>

          <section className="panel">
            <h2 className="text-xl font-bold">出典と確認した事実</h2>
            <p
              className="mt-2 text-sm text-stone-600"
              id="research-evidence-help"
            >
              最低1件必須です。出典種別と、その事実が支える分野を選択してください。市場数値は出典に記載された内容だけを事実メモへ入力してください。
            </p>
            {adoptedCandidate ? (
              <p className="mt-3 rounded-lg bg-violet-50 p-3 text-sm text-violet-950">
                検索候補のタイトルとURLを出典1へ入力しました。原文を確認し、出典種別と確認した事実を入力してください。
              </p>
            ) : null}
            <p
              className={`mt-3 rounded-lg p-3 text-sm ${
                sourceVerificationEnabled
                  ? "bg-green-50 text-green-900"
                  : "bg-amber-50 text-amber-950"
              }`}
              role="status"
            >
              {sourceVerificationEnabled
                ? "Server取得検証は有効です。許可済みドメインのHTTPS出典だけを保存できます。"
                : "Server取得検証は現在無効です。URLと事実メモは未検証の出典として保存されます。"}
            </p>
            {[0, 1, 2, 3, 4].map((index) => (
              <fieldset
                aria-describedby="research-evidence-help"
                className="mt-5 rounded-lg border border-stone-200 p-4"
                key={index}
              >
                <legend className="px-2 font-bold">出典 {index + 1}{index === 0 ? "（必須）" : "（任意）"}</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`sourceTitle${index}`} label="出典名">
                    <input className="field" id={`sourceTitle${index}`} name={`sourceTitle${index}`} maxLength={200} required={index === 0} defaultValue={index === 0 ? adoptedCandidate?.title : undefined} />
                  </Field>
                  <Field id={`sourceType${index}`} label="出典種別">
                    <select className="field" id={`sourceType${index}`} name={`sourceType${index}`} required={index === 0} defaultValue="">
                      <option value="">選択してください</option>
                      <option value="official">公的機関・公式一次情報</option>
                      <option value="platform">販売プラットフォーム公式</option>
                      <option value="industry_report">業界調査レポート</option>
                      <option value="store_ranking">ストアランキング</option>
                      <option value="news">報道・ニュース</option>
                      <option value="other">その他</option>
                    </select>
                  </Field>
                  <Field id={`sourceRetrievedAt${index}`} label="取得日時">
                    <input className="field" id={`sourceRetrievedAt${index}`} name={`sourceRetrievedAt${index}`} type="datetime-local" defaultValue={index === 0 ? now : undefined} required={index === 0} />
                  </Field>
                  <Field id={`sourcePublishedAt${index}`} label="公開日時（任意）">
                    <input className="field" id={`sourcePublishedAt${index}`} name={`sourcePublishedAt${index}`} type="datetime-local" defaultValue={index === 0 ? adoptedCandidate?.publishedAt?.slice(0, 16) : undefined} />
                  </Field>
                </div>
                <div className="mt-4 space-y-4">
                  <Field id={`sourceUrl${index}`} label="出典URL（HTTPS）">
                    <input className="field" id={`sourceUrl${index}`} name={`sourceUrl${index}`} type="url" placeholder="https://..." required={index === 0} defaultValue={index === 0 ? adoptedCandidate?.url : undefined} />
                  </Field>
                  <Field id={`sourceFact${index}`} label="出典で確認した事実">
                    <textarea className="field min-h-24" id={`sourceFact${index}`} name={`sourceFact${index}`} maxLength={1000} required={index === 0} />
                  </Field>
                  <fieldset>
                    <legend className="label">この事実が支える分野</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["demand", "市場需要"],
                        ["competition", "競合"],
                        ["audience", "読者"],
                        ["theme", "人気テーマ"],
                        ["price", "価格"],
                        ["channel", "販売チャネル"],
                        ["risk", "リスク"],
                      ].map(([value, label]) => (
                        <label className="flex items-center gap-2 text-sm" key={value}>
                          <input
                            defaultChecked={
                              index === 0 && adoptedCandidate?.topic === value
                            }
                            name={`sourceTopics${index}`}
                            type="checkbox"
                            value={value}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </fieldset>
            ))}
          </section>

          <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
            分析結果は事実と自動推論を区分して保存します。根拠のない市場規模・販売数・成長率は生成しません。
          </p>
          <button className="button w-full bg-violet-700 hover:bg-violet-800" type="submit">
            市場分析を実行して保存
          </button>
        </form>
      )}
    </main>
  );
}
