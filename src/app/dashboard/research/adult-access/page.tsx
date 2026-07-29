import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  cloudAdultResearchFeatureEnabled,
  getCloudAdultResearchAccess,
} from "@/lib/cloud-adult-research";
import {
  acceptCloudAdultResearchTermsAction,
  withdrawCloudAdultResearchTermsAction,
} from "./actions";

const reasonLabel = {
  allowed: "利用可能",
  feature_disabled: "現在停止中",
  entitlement_missing: "管理者の利用許可が必要",
  entitlement_inactive: "利用停止中",
  entitlement_expired: "利用期限切れ",
  consent_required: "年齢確認・専用規約への同意が必要",
  configuration_unavailable: "設定確認中",
} as const;

export default async function AdultResearchAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { profile } = await requireProfile();
  const { error, message } = await searchParams;
  const enabled = cloudAdultResearchFeatureEnabled();
  const access = await getCloudAdultResearchAccess(profile.id);
  const canConsent =
    enabled &&
    access.entitlement?.status === "approved" &&
    access.reason === "consent_required";

  return (
    <main className="page max-w-3xl">
      <Link className="text-violet-700 underline" href="/dashboard/research">
        ← 市場分析へ
      </Link>
      <h1 className="mt-4 text-3xl font-bold">成人向け市場分析オプション</h1>
      <p className="mt-3 text-stone-600">
        成人向け作品の市場傾向を分析する、許可制のオプション機能です。画像・本文の生成機能ではありません。
      </p>
      {error ? (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          className="mt-5 rounded-lg bg-green-50 p-4 text-green-800"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">現在の状態</h2>
        <p className="mt-3 text-lg font-bold">
          {reasonLabel[access.reason]}
        </p>
        {access.entitlement ? (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">許可区分</dt>
              <dd className="mt-1 font-bold">{access.entitlement.source}</dd>
            </div>
            <div>
              <dt className="text-stone-500">有効期限</dt>
              <dd className="mt-1 font-bold">
                {access.entitlement.valid_until
                  ? new Date(access.entitlement.valid_until).toLocaleString(
                      "ja-JP",
                    )
                  : "期限なし"}
              </dd>
            </div>
          </dl>
        ) : null}
      </section>

      {canConsent ? (
        <form action={acceptCloudAdultResearchTermsAction} className="panel mt-6">
          <h2 className="text-xl font-bold">利用確認</h2>
          <div className="mt-5 space-y-4">
            <label className="flex items-start gap-3">
              <input
                className="mt-1"
                name="ageConfirmed"
                required
                type="checkbox"
                value="yes"
              />
              <span>私は18歳以上です。</span>
            </label>
            <label className="flex items-start gap-3">
              <input
                className="mt-1"
                name="termsAccepted"
                required
                type="checkbox"
                value="yes"
              />
              <span>
                成人向け市場分析専用規約に同意し、分析目的以外の違法な内容を入力しません。
              </span>
            </label>
          </div>
          <button
            className="button mt-6 bg-violet-700 hover:bg-violet-800"
            type="submit"
          >
            確認して利用を開始
          </button>
        </form>
      ) : null}

      {access.allowed ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">利用可能です</h2>
          <p className="mt-2 text-stone-600">
            新しい市場分析で「成人向け」を選択できます。
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              className="button bg-violet-700 hover:bg-violet-800"
              href="/dashboard/research/new"
            >
              成人向け市場分析を開始
            </Link>
            <form action={withdrawCloudAdultResearchTermsAction}>
              <button className="button-secondary" type="submit">
                利用同意を解除
              </button>
            </form>
          </div>
        </section>
      ) : null}
    </main>
  );
}
