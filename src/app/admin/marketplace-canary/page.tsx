import { CircleAlert, CircleCheck, LockKeyhole, Store } from "lucide-react";
import { MarketplaceCheckoutReadinessPanel } from "@/components/admin/MarketplaceCheckoutReadinessPanel";
import { requireAdmin } from "@/lib/auth";
import { safelyLoadAdminData } from "@/lib/admin-resilience";
import { assessMarketplaceCheckoutOperationalReadiness } from "@/modules/checkout/domain/marketplace-checkout-operational-readiness";
import { loadAdminMarketplaceProductionCanaryInventory } from "@/modules/checkout/infrastructure/admin-production-canary-inventory-repository";
import { loadAdminMarketplacePublicationFixationReadiness } from "@/modules/checkout/infrastructure/admin-publication-fixation-readiness-repository";
import { loadAdminMarketplacePublicationMigrationReadiness } from "@/modules/checkout/infrastructure/admin-publication-migration-readiness-repository";

export const dynamic = "force-dynamic";

const checkLabels = {
  "bounded-inventory": "監査範囲が完全",
  "eligible-products": "canary候補商品あり",
} as const;

const migrationCheckLabels = {
  dependencies: "依存schemaが揃っている",
  "pre-apply-state": "未適用schemaが一貫している",
  "inventory-complete": "対象件数を上限内で全件確認できる",
  "unpublished-cloud-works": "未固定の公開済みCloud作品がない",
  "inactive-cloud-products": "未固定Cloud作品に紐づくactive商品がない",
  "unique-project-work": "1つのCloud Projectに作品が重複していない",
} as const;

const fixationCheckLabels = {
  "bounded-inventory": "監査範囲が完全",
  "mutable-cloud-works": "未公開・未固定のCloud作品がある",
  "owner-alignment": "作品と制作Projectの所有者が一致",
  "release-checkpoints": "完成版checkpointがある",
  "complete-checkpoint-pages": "完成版のページ構成が完全",
  "fixation-targets": "固定可能な作品とpaused商品がある",
} as const;

export default async function AdminMarketplaceCanaryPage() {
  await requireAdmin();
  const checkoutReadiness = assessMarketplaceCheckoutOperationalReadiness();
  const inventory = await safelyLoadAdminData(
    "marketplace-production-canary-inventory",
    () => loadAdminMarketplaceProductionCanaryInventory(),
  );
  const migrationReadiness = await safelyLoadAdminData(
    "marketplace-publication-migration-readiness",
    () => loadAdminMarketplacePublicationMigrationReadiness(),
  );
  const fixationReadiness = await safelyLoadAdminData(
    "marketplace-publication-fixation-readiness",
    () => loadAdminMarketplacePublicationFixationReadiness(),
  );

  return (
    <main className="page">
      <h1 className="text-3xl font-bold">Marketplace Production canary候補</h1>
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-stone-600">
        Productionの一般向け商品から、1件canary販売の条件を満たす候補があるかを件数だけで確認します。商品名、利用者名、メールアドレス、内部IDは表示しません。
      </p>

      <MarketplaceCheckoutReadinessPanel readiness={checkoutReadiness} />

      {!inventory.ok ? (
        <section
          className="panel mt-6 border-amber-200 bg-amber-50"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CircleAlert
              aria-hidden="true"
              className="mt-1 h-6 w-6 text-amber-700"
            />
            <div>
              <h2 className="text-xl font-bold text-amber-950">
                現在は件数を確認できません
              </h2>
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
              <div>
                <h2 className="text-xl font-bold">
                  {inventory.value.passed
                    ? "候補があります"
                    : "現在は候補を確定できません"}
                </h2>
                <p className="mt-2 leading-relaxed">
                  この確認は読み取り専用です。販売開始、注文作成、Stripe接続、ファイル取得は行いません。
                </p>
              </div>
            </div>
          </section>

          <section
            className="mt-6 grid gap-4 sm:grid-cols-3"
            aria-label="候補件数"
          >
            {[
              [
                "確認したactive商品",
                inventory.value.counts.checkedActiveProducts,
              ],
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
                    <CircleCheck
                      aria-hidden="true"
                      className="h-5 w-5 text-emerald-700"
                    />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="h-5 w-5 text-amber-700"
                    />
                  )}
                  <span>{checkLabels[check.id]}</span>
                  <span className="font-semibold">
                    {check.ready ? "READY" : "PENDING"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel mt-6">
            <h2 className="text-xl font-bold">次の候補準備</h2>
            <p className="mt-2 leading-relaxed text-stone-600">
              販売状態を変更せず、paused商品の中にcanary条件を満たせる候補があるかを件数だけで確認します。
            </p>
            <div
              className="mt-4 grid gap-4 sm:grid-cols-3"
              aria-label="候補準備件数"
            >
              {[
                [
                  "確認した登録商品",
                  inventory.value.preparation.checkedProducts,
                ],
                ["paused商品", inventory.value.preparation.pausedProducts],
                [
                  "有効化可能なpaused商品",
                  inventory.value.preparation.activationReadyPausedProducts,
                ],
              ].map(([label, count]) => (
                <div
                  className="rounded-2xl border border-stone-200 bg-white p-4"
                  key={label}
                >
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
            {inventory.value.preparationDiagnostics.audited &&
            inventory.value.preparation.pausedProducts > 0 ? (
              <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
                <h3 className="font-bold">paused商品の条件別充足数</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  個別の商品や作品を表示せず、各条件を満たすpaused商品の件数だけを示します。
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    [
                      "価格（50〜1,000円）",
                      inventory.value.preparationDiagnostics
                        .priceReadyPausedProducts,
                    ],
                    [
                      "販売ファイル",
                      inventory.value.preparationDiagnostics
                        .fileReadyPausedProducts,
                    ],
                    [
                      "所有者が一致する作品",
                      inventory.value.preparationDiagnostics
                        .linkedWorkReadyPausedProducts,
                    ],
                    [
                      "公開済みの一般向け作品",
                      inventory.value.preparationDiagnostics
                        .publicGeneralWorkReadyPausedProducts,
                    ],
                    [
                      "Cloud完成版の固定",
                      inventory.value.preparationDiagnostics
                        .publicationReadyPausedProducts,
                    ],
                    [
                      "販売者権限",
                      inventory.value.preparationDiagnostics
                        .sellerRoleReadyPausedProducts,
                    ],
                  ].map(([label, count]) => (
                    <div
                      className="flex items-center justify-between gap-3"
                      key={label}
                    >
                      <dt>{label}</dt>
                      <dd className="font-semibold">
                        {count} / {inventory.value.preparation.pausedProducts}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {inventory.value.preparationRemediation.audited &&
            inventory.value.preparation.pausedProducts > 0 ? (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <h3 className="font-bold text-violet-950">
                  候補化までに必要な確認
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-violet-900">
                  paused商品を重複しない区分へ分けます。作品公開やCloud完成版の変更は行わず、別承認が必要な確認件数だけを表示します。
                </p>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {[
                    [
                      "そのまま有効化前候補",
                      inventory.value.preparationRemediation
                        .activationReadyPausedProducts,
                    ],
                    [
                      "作品の公開設定を確認",
                      inventory.value.preparationRemediation
                        .workPublicationReviewPausedProducts,
                    ],
                    [
                      "Cloud完成版の固定を確認",
                      inventory.value.preparationRemediation
                        .cloudPublicationReviewPausedProducts,
                    ],
                    [
                      "作品公開とCloud完成版を確認",
                      inventory.value.preparationRemediation
                        .workAndCloudPublicationReviewPausedProducts,
                    ],
                    [
                      "価格・ファイル・所有者・権限等を確認",
                      inventory.value.preparationRemediation
                        .otherBlockerPausedProducts,
                    ],
                  ].map(([label, count]) => (
                    <div
                      className="flex items-center justify-between gap-3"
                      key={label}
                    >
                      <dt>{label}</dt>
                      <dd className="font-semibold">{count}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              この画面から商品を有効化・作成することはありません。候補がない場合は、販売パッケージから一般向け商品を準備します。
            </p>
          </section>

          <section className="panel mt-6">
            <h2 className="text-xl font-bold">商品化できる公開作品</h2>
            <p className="mt-2 leading-relaxed text-stone-600">
              商品がまだ登録されていない場合に備え、公開済みの一般向け作品から販売パッケージを準備できる候補を件数だけで確認します。
            </p>
            <div
              className="mt-4 grid gap-4 sm:grid-cols-3"
              aria-label="商品化準備件数"
            >
              {[
                [
                  "確認した公開作品",
                  inventory.value.sourcePreparation.checkedWorks,
                ],
                [
                  "商品未登録の公開作品",
                  inventory.value.sourcePreparation.unregisteredWorks,
                ],
                [
                  "商品化準備が可能な作品",
                  inventory.value.sourcePreparation.registrationReadyWorks,
                ],
              ].map(([label, count]) => (
                <div
                  className="rounded-2xl border border-stone-200 bg-white p-4"
                  key={label}
                >
                  <p className="text-stone-600">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{count}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 font-semibold">
              {!inventory.value.sourcePreparation.audited ||
              !inventory.value.sourcePreparation.complete
                ? "公開作品の全件監査を完了できませんでした。"
                : inventory.value.sourcePreparation.ready
                  ? `商品化準備の候補があります（販売者${inventory.value.sourcePreparation.registrationReadySellers}名）`
                  : "現在、商品化準備が可能な公開作品はありません。"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              この集計から販売パッケージや商品を自動作成しません。対象作品の選定と商品登録は別工程です。
            </p>
          </section>
        </>
      )}

      <section
        className="panel mt-6"
        aria-labelledby="publication-migration-heading"
      >
        <h2 className="text-xl font-bold" id="publication-migration-heading">
          Cloud完成版migration 適用前確認
        </h2>
        <p className="mt-2 leading-relaxed text-stone-600">
          Production資格情報を端末へ取り出さず、依存schema・未適用状態・既存Cloud作品と商品を読み取り専用で確認します。この画面からmigrationは適用できません。
        </p>

        {!migrationReadiness.ok ? (
          <div
            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CircleAlert
                aria-hidden="true"
                className="mt-1 h-5 w-5 text-amber-700"
              />
              <div>
                <h3 className="font-bold text-amber-950">
                  現在は適用前条件を確認できません
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  Production管理画面で再読み込みし、同じ状態が続く場合は接続設定を確認してください。誤った判定で適用を進めることはありません。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                migrationReadiness.value.passed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {migrationReadiness.value.passed ? (
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
                    {migrationReadiness.value.passed
                      ? "適用前条件を満たしています"
                      : migrationReadiness.value.state === "already-applied"
                        ? "migration artifactは適用済みです"
                        : migrationReadiness.value.state === "partial"
                          ? "部分適用状態のため停止しています"
                          : "適用前に確認が必要です"}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed">
                    schema状態: {migrationReadiness.value.state}
                    。確認はSELECTのみで、作品公開、商品変更、決済、ファイル取得は行いません。
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                [
                  "確認したCloud作品",
                  migrationReadiness.value.counts.checkedCloudWorks,
                ],
                [
                  "確認したactive商品",
                  migrationReadiness.value.counts.checkedActiveProducts,
                ],
                [
                  "公開済みCloud作品",
                  migrationReadiness.value.counts.publicOrPublishedCloudWorks,
                ],
                [
                  "active Cloud商品",
                  migrationReadiness.value.counts.activeCloudProducts,
                ],
                [
                  "重複Project mapping",
                  migrationReadiness.value.counts.duplicateCloudProjectMappings,
                ],
              ].map(([label, count]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3"
                  key={label}
                >
                  <dt>{label}</dt>
                  <dd className="font-semibold">{count}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-4 space-y-2">
              {migrationReadiness.value.checks.map((check) => (
                <li className="flex items-center gap-3 text-sm" key={check.id}>
                  {check.ready ? (
                    <CircleCheck
                      aria-hidden="true"
                      className="h-4 w-4 text-emerald-700"
                    />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="h-4 w-4 text-amber-700"
                    />
                  )}
                  <span>{migrationCheckLabels[check.id]}</span>
                  <span className="font-semibold">
                    {check.ready ? "READY" : "PENDING"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="mt-4 text-sm leading-relaxed text-stone-600">
          READYでも適用は自動実行しません。原本SHA-256の再照合と責任者の明示承認後に、別工程で1回だけ適用します。
        </p>
      </section>

      <section
        className="panel mt-6"
        aria-labelledby="publication-fixation-heading"
      >
        <h2 className="text-xl font-bold" id="publication-fixation-heading">
          Cloud完成版固定の準備確認
        </h2>
        <p className="mt-2 leading-relaxed text-stone-600">
          {
            "未公開のCloud作品、paused商品、完成版checkpointとページ構成を匿名件数で照合します。同期RPCやStorage object取得は行いません。"
          }
        </p>

        {!fixationReadiness.ok ? (
          <div
            className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4"
            role="status"
          >
            <div className="flex items-start gap-3">
              <CircleAlert
                aria-hidden="true"
                className="mt-1 h-5 w-5 text-amber-700"
              />
              <div>
                <h3 className="font-bold text-amber-950">
                  現在は固定候補を確認できません
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-amber-900">
                  Production管理画面で再読み込みし、同じ状態が続く場合は対象schemaを確認してください。候補を推測して固定することはありません。
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div
              className={`mt-4 rounded-2xl border p-4 ${
                fixationReadiness.value.passed
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {fixationReadiness.value.passed ? (
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
                    {fixationReadiness.value.passed
                      ? "完成版固定の候補があります"
                      : "完成版固定の前に確認が必要です"}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed">
                    この画面から完成版固定は実行できません。候補があっても利用者のCloud制作画面で完成版を選択する別工程です。
                  </p>
                </div>
              </div>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {[
                [
                  "確認したCloud作品",
                  fixationReadiness.value.counts.checkedCloudWorks,
                ],
                [
                  "未公開・未固定の作品",
                  fixationReadiness.value.counts.unpinnedMutableCloudWorks,
                ],
                [
                  "所有者一致の作品",
                  fixationReadiness.value.counts.ownerAlignedCloudWorks,
                ],
                [
                  "paused商品に紐づく作品",
                  fixationReadiness.value.counts.pausedProductCloudWorks,
                ],
                [
                  "完成版checkpoint",
                  fixationReadiness.value.counts.releaseCheckpoints,
                ],
                [
                  "ページ構成が完全な完成版",
                  fixationReadiness.value.counts.completeReleaseCheckpoints,
                ],
                [
                  "固定可能な作品",
                  fixationReadiness.value.counts.fixationReadyWorks,
                ],
                [
                  "固定後に更新するpaused商品",
                  fixationReadiness.value.counts.fixationReadyProducts,
                ],
              ].map(([label, count]) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3"
                  key={label}
                >
                  <dt>{label}</dt>
                  <dd className="font-semibold">{count}</dd>
                </div>
              ))}
            </dl>

            <ul className="mt-4 space-y-2">
              {fixationReadiness.value.checks.map((check) => (
                <li className="flex items-center gap-3 text-sm" key={check.id}>
                  {check.ready ? (
                    <CircleCheck
                      aria-hidden="true"
                      className="h-4 w-4 text-emerald-700"
                    />
                  ) : (
                    <CircleAlert
                      aria-hidden="true"
                      className="h-4 w-4 text-amber-700"
                    />
                  )}
                  <span>{fixationCheckLabels[check.id]}</span>
                  <span className="font-semibold">
                    {check.ready ? "READY" : "PENDING"}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel mt-6 border-violet-200 bg-violet-50">
        <div className="flex items-start gap-3">
          <LockKeyhole
            aria-hidden="true"
            className="mt-1 h-6 w-6 text-violet-700"
          />
          <div>
            <h2 className="text-xl font-bold text-violet-950">
              次の工程は別承認です
            </h2>
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
