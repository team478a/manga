import { CircleAlert, CircleCheck } from "lucide-react";
import type { AdminLoadResult } from "@/lib/admin-resilience";
import type { MarketplaceLiveLaunchReadiness } from "@/modules/checkout/domain/marketplace-live-launch-readiness";

const checkLabels = {
  "checkout-settings": "限定本番の購入設定",
  "exact-product": "設定対象の商品",
  "public-fixed-work": "公開作品とCloud完成版",
  "isolated-participants": "販売者と指定購入者",
  "no-existing-order": "本番注文の重複防止",
} as const;

export function MarketplaceLiveLaunchReadinessPanel({
  result,
}: {
  result: AdminLoadResult<MarketplaceLiveLaunchReadiness>;
}) {
  const report = result.ok ? result.value : null;
  const ready = report?.ready === true;

  return (
    <section
      aria-labelledby="live-launch-readiness-heading"
      className={`panel mt-6 ${
        ready
          ? "border-emerald-200 bg-emerald-50"
          : "border-amber-200 bg-amber-50"
      }`}
      role="status"
    >
      <div className="flex items-start gap-3">
        {ready ? (
          <CircleCheck
            aria-hidden="true"
            className="mt-1 h-6 w-6 text-emerald-700"
          />
        ) : (
          <CircleAlert
            aria-hidden="true"
            className="mt-1 h-6 w-6 text-amber-700"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold" id="live-launch-readiness-heading">
            限定販売の開始判定: {ready ? "READY" : "PENDING"}
          </h2>
          <p className="mt-2 leading-relaxed">
            {ready
              ? "設定された1件canaryの開始条件が揃っています。この画面では販売開始や購入を実行しません。"
              : result.ok
                ? "開始前に未完了の条件を確認してください。PENDINGのまま購入操作は行いません。"
                : "現在は開始条件を安全に確認できません。Production管理画面で再読み込みしてください。"}
          </p>

          {report ? (
            <ul className="mt-4 space-y-3">
              {report.checks.map((item) => (
                <li
                  className="rounded-xl border border-white/70 bg-white p-3"
                  key={item.id}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">
                      {checkLabels[item.id]}
                    </span>
                    <span className="text-sm font-bold">
                      {item.ready ? "READY" : "PENDING"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-stone-700">
                    {item.reason}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-4 text-sm leading-relaxed text-stone-700">
            対象の商品・販売者・購入者のID、氏名、メール、販売ファイル、plan
            fingerprintは表示しません。確認はSELECTのみで、注文作成、決済、設定変更、商品変更は行いません。
          </p>
        </div>
      </div>
    </section>
  );
}
