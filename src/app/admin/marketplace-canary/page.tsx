import { CircleAlert, CircleCheck, LockKeyhole, Store } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { loadAdminMarketplaceProductionCanaryInventory } from "@/modules/checkout/infrastructure/admin-production-canary-inventory-repository";

export const dynamic = "force-dynamic";

const checkLabels = {
  "bounded-inventory": "監査範囲が完全",
  "eligible-products": "canary候補商品あり",
} as const;

export default async function AdminMarketplaceCanaryPage() {
  await requireAdmin();
  const inventory = await safelyLoadAdminData(
    "marketplace-production-canary-inventory",
    () => loadAdminMarketplaceProductionCanaryInventory(),
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">Marketplace Production canary候補</h1>
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-stone-600">
        Productionの一般向け商品から、1件canary販売の条件を満たす候補があるかを件数だけで確認します。商品名、利用者名、メールアドレス、内部IDは表示しません。
      </p>

      {!inventory.ok ? (
        <section className="panel mt-6 border-amber-200 bg-amber-50" role="status">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-1 h-6 w-6 text-amber-700" />
            <div>
              <h2 className="text-xl font-bold text-amber-950">現在は件数を確認できません</h2>
              <p className="mt-2 leading-relaxed text-amber-900">
                Previewやローカル環境、またはProductionデータベースを安全に読み取れない場合は、誤った件数を表示せず停止します。Productionの管理画面で再読み込みしてください。
              </p>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section
            className={`panel mt-6 ${inventory.value.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
            role="status"
          >
            <div className="flex items-start gap-3">
              {inventory.value.passed ? (
                <CircleCheck aria-hidden="true" className="mt-1 h-6 w-6 text-emerald-700" />
              ) : (
                <CircleAlert aria-hidden="true" className="mt-1 h-6 w-6 text-amber-700" />
              )}
              <div>
                <h2 className="text-xl font-bold">
                  {inventory.value.passed ? "候補があります" : "現在は候補を確定できません"}
                </h2>
                <p className="mt-2 leading-relaxed">
                  この確認は読み取り専用です。販売開始、注文作成、Stripe接続、ファイル取得は行いません。
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="候補件数">
            {[
              ["確認したactive商品", inventory.value.counts.checkedActiveProducts],
              ["候補商品", inventory.value.counts.eligibleProducts],
              ["候補販売者", inventory.value.counts.eligibleSellers],
            ].map(([label, count]) => (
              <div className="panel" key={label}>
                <p className="text-stone-600">{label}</p>
                <p className="mt-3 text-4xl font-bold">{count}</p>
              </div>
            ))}
          </section>

          <section className="panel mt-6">
            <h2 className="text-xl font-bold">判定条件</h2>
            <ul className="mt-4 space-y-3">
              {inventory.value.checks.map((check) => (
                <li className="flex items-center gap-3" key={check.id}>
                  {check.ready ? (
                    <CircleCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="h-5 w-5 text-amber-700" />
                  )}
                  <span>{checkLabels[check.id]}</span>
                  <span className="font-semibold">{check.ready ? "READY" : "PENDING"}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel mt-6">
            <h2 className="text-xl font-bold">次の候補準備</h2>
            <p className="mt-2 leading-relaxed text-stone-600">
              販売状態を変更せず、paused商品の中にcanary条件を満たせる候補があるかを件数だけで確認します。
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3" aria-label="候補準備件数">
              {[
                ["確認した登録商品", inventory.value.preparation.checkedProducts],
                ["paused商品", inventory.value.preparation.pausedProducts],
                [
                  "有効化可能なpaused商品",
                  inventory.value.preparation.activationReadyPausedProducts,
                ],
              ].map(([label, count]) => (
                <div className="rounded-2xl border border-stone-200 bg-white p-4" key={label}>
                  <p className="text-stone-600">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{count}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 font-semibold">
              {inventory.value.preparation.ready
                ? `有効化前の候補があります（販売者${inventory.value.preparation.activationReadySellers}名）`
                : "現在、有効化できるpaused商品はありません。"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              この画面から商品を有効化・作成することはありません。候補がない場合は、販売パッケージから一般向け商品を準備します。
            </p>
          </section>
        </>
      )}

      <section className="panel mt-6 border-violet-200 bg-violet-50">
        <div className="flex items-start gap-3">
          <LockKeyhole aria-hidden="true" className="mt-1 h-6 w-6 text-violet-700" />
          <div>
            <h2 className="text-xl font-bold text-violet-950">次の工程は別承認です</h2>
            <p className="mt-2 leading-relaxed text-violet-900">
              候補があっても対象商品・販売者・購入者はこの画面では選定しません。販売計画、live設定、実決済はそれぞれ責任者の明示承認後に進めます。
            </p>
          </div>
        </div>
      </section>

      <p className="mt-6 inline-flex items-center gap-2 text-sm text-stone-500">
        <Store aria-hidden="true" className="h-4 w-4" />
        一般向けMarketplace限定。成人向けDesktopとCloud AI生成は対象外です。
      </p>
    </main>
  );
}
