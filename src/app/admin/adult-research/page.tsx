import Link from "next/link";
import { AdminDataUnavailable } from "@/components/admin/AdminDataUnavailable";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { requireAdmin } from "@/lib/auth";
import { cloudAdultResearchFeatureEnabled } from "@/lib/cloud-adult-research";
import { hasSupabaseAdminEnv } from "@/lib/env";
import { loadAdultResearchAdminOverview } from "@/modules/adult-research/infrastructure/admin-repository";
import { setCloudAdultResearchEnabledAction } from "./actions";

export default async function AdminAdultResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  await requireAdmin();
  const { error, message } = await searchParams;
  const envEnabled = cloudAdultResearchFeatureEnabled();
  let configured = false;
  let databaseEnabled = false;
  let approvedCount = 0;
  if (hasSupabaseAdminEnv()) {
    const loaded = await safelyLoadAdminData("adult-research", async () => {
      return loadAdultResearchAdminOverview();
    });
    if (!loaded.ok) return <AdminDataUnavailable title="成人向け市場分析の運用" />;
    const [settingsResult, approvedResult] = loaded.value;
    configured = !settingsResult.error && Boolean(settingsResult.data);
    databaseEnabled = settingsResult.data?.enabled === true;
    approvedCount = approvedResult.count ?? 0;
  }

  return (
    <main className="page max-w-4xl">
      <Link className="text-violet-700 underline" href="/admin">
        ← 管理者ダッシュボード
      </Link>
      <h1 className="mt-4 text-3xl font-bold">成人向け市場分析の運用</h1>
      <p className="mt-3 text-stone-600">
        環境変数とDB側Kill Switchの両方が有効で、個別許可と本人同意が揃った利用者だけが実行できます。
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

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="panel">
          <p className="text-sm text-stone-500">環境Feature Flag</p>
          <p className="mt-2 text-xl font-bold">
            {envEnabled ? "有効" : "停止"}
          </p>
        </div>
        <div className="panel">
          <p className="text-sm text-stone-500">DB Kill Switch</p>
          <p className="mt-2 text-xl font-bold">
            {configured ? (databaseEnabled ? "有効" : "停止") : "未設定"}
          </p>
        </div>
        <div className="panel">
          <p className="text-sm text-stone-500">個別許可数</p>
          <p className="mt-2 text-xl font-bold">
            {approvedCount}件
          </p>
        </div>
      </section>

      {!configured ? (
        <section className="panel mt-6">
          <h2 className="text-xl font-bold">migrationが必要です</h2>
          <p className="mt-2 text-stone-600">
            Release 1.1 migration適用後に全体設定を操作できます。
          </p>
        </section>
      ) : (
        <form action={setCloudAdultResearchEnabledAction} className="panel mt-6">
          <h2 className="text-xl font-bold">DB側全体設定</h2>
          <p className="mt-2 text-stone-600">
            緊急時はここを停止すると、成人向けReportの新規作成と再表示をRLSで停止できます。
          </p>
          <select
            className="field mt-5"
            defaultValue={databaseEnabled ? "true" : "false"}
            name="enabled"
          >
            <option value="false">停止</option>
            <option value="true">有効</option>
          </select>
          <button
            className="button mt-5 bg-violet-700 hover:bg-violet-800"
            type="submit"
          >
            全体設定を更新
          </button>
        </form>
      )}

      <section className="panel mt-6">
        <h2 className="text-xl font-bold">個別許可</h2>
        <p className="mt-2 text-stone-600">
          ユーザー詳細画面から、既存購入者・購入済み・管理者付与・キャンペーンの区分で許可できます。
        </p>
        <Link className="button-secondary mt-5" href="/admin/users">
          ユーザー管理へ
        </Link>
      </section>
    </main>
  );
}
