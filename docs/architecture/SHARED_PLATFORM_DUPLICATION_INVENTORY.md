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
| DUP-009 | Storage | signed URL発行 | Cloud Creator assets/exports、purchases、monitor、Cloud AI | 6系統以上 | domain別serviceを維持 | bucket/path/TTL/owner条件が異なる | R3-5b（監査完了・統合しない） |
| DUP-010 | UI | pending button | `src/components/PendingSubmitButton.tsx`と専用submit components | 5系統以上 | 既存`PendingSubmitButton` | 二重送信制御や遷移方式の差 | R3-4 |
| DUP-011 | UI | partial data notice | admin/creator dashboardの部分失敗表示、`admin-resilience.ts`利用箇所 | 8以上 | 共通表示component＋既存loader | 警告をfatal errorへ変えない | R3-4 |
| DUP-012 | UI | empty state | `src/components/EmptyState.tsx`とinline empty panels | 10以上 | 既存`EmptyState` | CTA、権限、検索結果0件の意味が異なる | R3-4 |
| DUP-013 | UI | error boundary | `src/components/AsyncStateShell.tsx`、9つのerror boundary、4つのloading boundary | 9 error／4 loading | 共通visual shellのみ | reset範囲・ログcontextを失う | R3-4a |
| DUP-014 | Audit | 監査ログ書込み | Cloud AI admin、general monitor、provider settings、account operation | 5系統以上 | DB transaction／domain repositoryを維持 | event名・payload・秘匿境界の破壊 | R3-5b（監査完了・統合しない） |
| DUP-015 | Infra | rate limit | `cloud-ai-rate-limit.ts`、`cloud-research-search-rate-limit.ts`、`desktop-device-rate-limit.ts` | 3実装 | `src/lib/rate-limit-primitives.ts` | key、window、上限、failure statusが外部契約 | R3-5b（低水準primitive完了） |
| DUP-016 | Readiness | Provider readiness | Cloud AI readiness、general monitor readiness、provider settings | 3系統以上 | domain別readinessを維持 | 成人向け/一般向けProvider境界の混同 | R3-5b（監査完了・統合しない） |
| DUP-017 | Worker auth | secret比較 | Cloud AI/export/storage/monitor worker routes | 4 | `src/lib/internal-worker-auth.ts` | status/body、secret名、比較順の差 | R3-5a（完了） |
| DUP-018 | Forms | FormData文字列取得 | `src/app/actions/shared/form-data.ts`と各Actionの`field`/`value` | 8以上 | 既存`formText` | trim、空文字、optionalの意味が異なる | R3-1 |
| DUP-019 | Resilience | optional readの部分失敗化 | `admin-resilience.ts`、`cloud-runtime-resilience.ts` | 2基盤＋多数利用 | 既存2 helperを維持 | adminと利用者画面のログ/表示契約差 | R3-5b（監査完了・統合しない） |

## 実装進捗

- PR-R3-4a: page／panel／action rowだけを`AsyncStateShell.tsx`へ共通化し、9つのerror boundaryと4つのloading boundaryを移行した。固有文言、CTA、URL、reset範囲、ログcontext、ARIA、spinner／skeletonは各featureに維持した。
- PR-R3-4b: 市場分析からネームまでの4つの専用submit componentを既存`PendingSubmitButton`へ委譲し、DUP-010のAI送信pending検出、二重送信防止、busy通知、spinnerを共通化した。専用component名、文言、class、Server Actionは維持した。
- PR-R3-4c: 企画比較からネーム版までの4画面で完全一致するAction成功／失敗feedbackを`CloudActionFeedback.tsx`へ移した。表示順、要素、class、ARIA、query値、Server Actionは維持した。
- PR-R3-4d: 管理者／制作者の作品、商品、グッズ申請、ユーザー画面の8画面で一致するlinen色のstatus badge visual shellを`StatusBadge.tsx`へ移した。`statusLabel`、公開／非公開判断、role表示、配置classは各画面に維持した。色付きアカウント状態badgeと作成日chipは統合しない。
- PR-R3-4e: 認証、購入、作品、商品、グッズ申請、Desktop端末、Cloud作品の20画面21箇所で完全一致するinline error visual shellを`InlineErrorMessage.tsx`へ移した。表示条件、error値、購入不可文言、既存ARIAは各画面に維持した。角丸、色、余白、ARIAが異なるerror表示は統合しない。
- PR-R3-4f: 管理、一般モニター、市場分析、企画、シナリオ、ネームの10画面11箇所で完全一致する`rounded-lg` inline alert errorを既存`InlineErrorMessage`へ追加統合した。`radius` variantはvisual radiusだけを選び、既存21箇所の`rounded-md`、全32箇所の要素、色、余白、ARIA、文言、表示条件を維持する。
- PR-R3-4g: Cloud市場分析workflowのApp Router上にある全4つのnot-found boundaryで完全一致するpage／panel visual shellを、既存`AsyncStatePage`／`AsyncStatePanel`へ移した。見出し、説明、icon、ARIA、Link、URLは各boundaryに維持する。
- R3-4完了: DUP-011のpartial noticeは既存`CloudDataNotice`へ集約済み。通常一覧のDUP-012は要素、icon、margin、CTA、権限、検索結果0件の意味が異なり、paginationも表示件数、状態reset、ページ意味が異なるため統合しない。
- PR-R3-5a: DUP-017の4つのinternal Worker RouteからBearer secret比較だけを`src/lib/internal-worker-auth.ts`へ移した。header解析、secret未設定／32文字未満／長さ不一致の拒否、同一長のconstant-time比較を共通化し、環境変数名、status/body、feature flag、ログ、Worker処理順は各Routeに維持した。
- PR-R3-5b: DUP-015のHMAC-SHA256 subject hashとclient IP抽出だけを`rate-limit-primitives.ts`へ移した。secret、key、window、上限、RPC、例外、status/bodyは各機能に維持した。DUP-009／014／016／019はtransaction、Storage policy、一般／成人向け境界、fatal／partial継続の差をcharacterizationで固定し、統合しない。これによりR3-5の監査・実装は完了する。

## 統合しない重複

- signed URLのTTL、bucket、path、content type、owner条件
- rate limitのkey、window、上限、status/body
- domain別audit event名とpayload
- 成人向けと一般向けのProvider/readiness/entitlement
- Route HandlerとServer Actionのエラー契約
- loading/error boundaryのreset範囲とログcontext

