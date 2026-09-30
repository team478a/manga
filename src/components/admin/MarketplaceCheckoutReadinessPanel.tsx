import { CircleAlert, CircleCheck } from "lucide-react";
import type { MarketplaceCheckoutOperationalReadiness } from "@/modules/checkout/domain/marketplace-checkout-operational-readiness";

function formatCanaryExpiry(expiresAt: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(expiresAt));
}

export function MarketplaceCheckoutReadinessPanel({
  readiness,
}: {
  readiness: MarketplaceCheckoutOperationalReadiness;
}) {
  return (
    <section
      className="panel mt-6"
      aria-labelledby="checkout-readiness-heading"
    >
      <h2 className="text-xl font-bold" id="checkout-readiness-heading">
        限定販売の購入設定
      </h2>
      <p className="mt-2 leading-relaxed text-stone-600">
        購入モード、Stripe種別との一致、限定本番canaryの有効性を秘密情報なしで確認します。
      </p>

      <div
        className={`mt-4 rounded-2xl border p-4 ${
          readiness.ready
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
        role="status"
      >
        <div className="flex items-start gap-3">
          {readiness.ready ? (
            <CircleCheck
              aria-hidden="true"
              className="mt-1 h-5 w-5 text-emerald-700"
            />
          ) : (
            <CircleAlert
              aria-hidden="true"
              className="mt-1 h-5 w-5 text-amber-700"
            />
          )}
          <div>
            <h3 className="font-bold">
              購入設定は{readiness.ready ? "READY" : "PENDING"}です
            </h3>
            <p className="mt-1 text-sm leading-relaxed">
              現在のモード: {readiness.modeLabel}
            </p>
            {readiness.reason ? (
              <p className="mt-2 text-sm leading-relaxed">{readiness.reason}</p>
            ) : null}
          </div>
        </div>
      </div>

      {readiness.canary ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <dt>限定本番canary</dt>
            <dd className="font-semibold">
              {readiness.canary.ready ? "有効" : "確認が必要"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3">
            <dt>有効期限</dt>
            <dd className="text-right font-semibold">
              {readiness.canary.expiresAt ? (
                <>
                  <time dateTime={readiness.canary.expiresAt}>
                    {formatCanaryExpiry(readiness.canary.expiresAt)}
                  </time>
                  {readiness.canary.remainingMinutes !== null ? (
                    <span className="block font-normal text-stone-600">
                      残り約{readiness.canary.remainingMinutes}分
                    </span>
                  ) : null}
                </>
              ) : (
                "確認できません"
              )}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="mt-4 text-sm leading-relaxed text-stone-600">
        Stripeキー、商品・販売者・購入者の内部ID、plan
        fingerprintは表示しません。この確認から設定変更、注文作成、決済は行いません。
      </p>
    </section>
  );
}
