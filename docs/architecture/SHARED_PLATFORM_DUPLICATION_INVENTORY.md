# Shared Platform Duplication Inventory

## 監査条件

- 基準: `feature/manga-canvas-mvp` / `b2dfb1bdd00d3b838fbda6a8e3fcd4e6618b2f70`（PR #188取り込み済み）
- 対象: App Router、Server Action、`src/lib`、`src/modules`、共通React UI、内部Worker
- 方針: この台帳は候補を示す。外部契約とdomain固有ポリシーが一致しないものは統合しない。

| ID | 分類 | 処理 | 現在の場所 | 重複数 | 正本候補 | リスク | 対応PR |
|---|---|---|---|---:|---|---|---|
| DUP-001 | Validation | UUID検証 | `src/app/api/**`、`src/app/creator/**/actions.ts`、`src/lib/cloud-*-persistence.ts`、各module schema | 30以上 | `src/lib/validation/identifiers.ts`（新設候補）またはdomain schema | invalid時のstatus、`notFound`、redirect、例外型が異なる | R3-1（共通primitiveのみ） |
| DUP-002 | Navigation | 安全なredirect先選択 | `src/app/auth/callback/route.ts`、多数のServer Action内の手組みredirect | 10以上 | `src/lib/navigation/safe-redirect.ts`（新設候補） | allowlistを広げるとopen redirect、既存query encoding差異 | R3-1 |
| DUP-003 | Error | Action例外から利用者向けerrorへの変換 | `src/app/**/actions.ts`、`src/lib/domain-errors.ts` | 20以上 | `src/lib/action-errors.ts`（新設候補）＋既存domain error | raw DB/Provider error露出、文言・query名変更 | R3-1 |
| DUP-004 | Auth | owner確認 | `requireProfile`後の`.eq("profile_id", ...)`、Cloud Creator repository、各dashboard Action | 15以上 | module repositoryのowner-scoped method | service-roleでfilterを落とすと越権 | R3-2/R3-3 |
| DUP-005 | Auth | admin確認 | `src/lib/auth.ts#requireAdmin`と各`src/app/admin/**`入口 | 24以上の呼出し | `requireAdmin`を正本維持 | page/actionの片側だけに寄せると迂回可能 | R3-2 |
| DUP-006 | Entitlement | monitor利用資格確認 | `src/lib/cloud-general-monitor.ts`、monitor page/action/API | 6以上 | `requireCloudGeneralMonitor` | invite、active、期限、利用上限の意味を混同 | R3-2 |
| DUP-007 | Configuration | Feature Flag判定 | module別`*Enabled()`、Worker routes、`cloud-general-monitor-readiness.ts` | 21 flags | `src/lib/feature-flags/`（名前・defaultを固定） | Preview/Productionでdefault解釈が変わる | R3-2 |
| DUP-008 | Infrastructure | Supabase admin client直接利用 | `src/app/**` | 32 files | 各module repository、最小限のshared server gateway | RLS迂回、認証前利用、presentationへのDB契約漏出 | R3-3 |
| DUP-009 | Storage | signed URL発行 | Cloud Creator assets/exports、purchases、monitor、Cloud AI | 6系統以上 | 低水準signerのみ共通化候補 | bucket/path/TTL/owner条件が異なる | R3-5 |
| DUP-010 | UI | pending button | `src/components/PendingSubmitButton.tsx`と専用submit components | 5系統以上 | 既存`PendingSubmitButton` | 二重送信制御や遷移方式の差 | R3-4 |
| DUP-011 | UI | partial data notice | admin/creator dashboardの部分失敗表示、`admin-resilience.ts`利用箇所 | 8以上 | 共通表示component＋既存loader | 警告をfatal errorへ変えない | R3-4 |
| DUP-012 | UI | empty state | `src/components/EmptyState.tsx`とinline empty panels | 10以上 | 既存`EmptyState` | CTA、権限、検索結果0件の意味が異なる | R3-4 |
| DUP-013 | UI | error boundary | `src/components/AsyncStateShell.tsx`、9つのerror boundary、4つのloading boundary | 9 error／4 loading | 共通visual shellのみ | reset範囲・ログcontextを失う | R3-4a |
| DUP-014 | Audit | 監査ログ書込み | Cloud AI admin、general monitor、provider settings、account operation | 5系統以上 | shared port＋domain別event schema | event名・payload・秘匿境界の破壊 | R3-5 |
| DUP-015 | Infra | rate limit | `cloud-ai-rate-limit.ts`、`cloud-research-search-rate-limit.ts`、`desktop-device-rate-limit.ts` | 3実装 | interface/clockのみ共通候補 | key、window、上限、failure statusが外部契約 | R3-5 |
| DUP-016 | Readiness | Provider readiness | Cloud AI readiness、general monitor readiness、provider settings | 3系統以上 | shared result shapeのみ候補 | 成人向け/一般向けProvider境界の混同 | R3-5 |
| DUP-017 | Worker auth | secret比較 | Cloud AI/export/storage/monitor worker routes | 4 | `src/lib/internal-worker-auth.ts`（新設候補） | status/body、secret名、比較順の差 | R3-5 |
| DUP-018 | Forms | FormData文字列取得 | `src/app/actions/shared/form-data.ts`と各Actionの`field`/`value` | 8以上 | 既存`formText` | trim、空文字、optionalの意味が異なる | R3-1 |
| DUP-019 | Resilience | optional readの部分失敗化 | `admin-resilience.ts`、`cloud-runtime-resilience.ts` | 2基盤＋多数利用 | 既存2 helperの責務整理 | adminと利用者画面のログ/表示契約差 | R3-5 |

## 実装進捗

- PR-R3-4a: page／panel／action rowだけを`AsyncStateShell.tsx`へ共通化し、9つのerror boundaryと4つのloading boundaryを移行した。固有文言、CTA、URL、reset範囲、ログcontext、ARIA、spinner／skeletonは各featureに維持した。
- DUP-010〜012と、status badge、pagination、confirmation feedback、form errorはR3-4aに含めず、後続R3-4b以降で同義性を確認してから扱う。

## 統合しない重複

- signed URLのTTL、bucket、path、content type、owner条件
- rate limitのkey、window、上限、status/body
- domain別audit event名とpayload
- 成人向けと一般向けのProvider/readiness/entitlement
- Route HandlerとServer Actionのエラー契約
- loading/error boundaryのreset範囲とログcontext

