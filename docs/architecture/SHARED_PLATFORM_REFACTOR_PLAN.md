# Shared Platform Refactor Plan

## 1. 監査概要

PR-R3-0は、PR-R0〜R2Cと実Provider本番受入れ完了後の`b2dfb1bdd00d3b838fbda6a8e3fcd4e6618b2f70`を基準に、共通処理の重複と境界を文書化した。アプリケーションコード、React component、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、価格、Canvas、出力仕様は変更しない。

`npm run deps:check`の基準結果はmodule boundary error 0、warning 32。warningはすべて`src/app/**`からのSupabase admin client直接利用である。重大停止条件（open redirect、認証前の任意service-role DB操作、成人向けから一般向けProviderへの越境、raw Provider/DB error露出の新規発見）は確認されなかった。

## 2. 重複一覧

詳細は[SHARED_PLATFORM_DUPLICATION_INVENTORY.md](./SHARED_PLATFORM_DUPLICATION_INVENTORY.md)。主要19候補はUUID、redirect、Action error、owner/admin/monitor確認、Feature Flag、admin client、signed URL、pending/partial/empty/error UI、audit、rate limit、readiness、Worker secret、FormData、部分失敗読取である。

## 3. 現在の配置

| 責務 | 主な現在地 |
|---|---|
| Auth/admin | `src/lib/auth.ts`、`src/app/admin/**` |
| Entitlement/readiness | `src/lib/cloud-general-monitor.ts`、`src/lib/cloud-general-monitor-readiness.ts`、各Cloud module |
| Error contract | `src/lib/domain-errors.ts`、`src/lib/api-errors.ts`、`src/lib/api-error-contract.ts`、各Action |
| Form/validation | `src/app/actions/shared/form-data.ts`、各Route/ActionのZod schema |
| Admin DB | `src/lib/supabase/admin.ts`、`src/app/**`32ファイル、module repositories |
| Storage transaction | `src/app/actions/shared/storage-transaction.ts`、module storage adapters |
| Optional reads | `src/lib/admin-resilience.ts`、`src/lib/cloud-runtime-resilience.ts` |
| UI state | `src/components/PendingSubmitButton.tsx`、`src/components/EmptyState.tsx`、各segmentの`error.tsx`/`loading.tsx` |
| Rate limit | `src/lib/cloud-ai-rate-limit.ts`、`cloud-research-search-rate-limit.ts`、`desktop-device-rate-limit.ts` |

## 4. 推奨正本

- API error: 既存`api-errors.ts`と`api-error-contract.ts`を維持する。
- Domain error: 既存`domain-errors.ts`を維持し、Action向けmappingだけ薄く追加する。
- Auth: 既存`requireProfile`/`requireAdmin`を正本とする。
- FormData: 既存`formText`を、意味が同じ箇所だけで利用する。
- Pending/empty UI: 既存`PendingSubmitButton`/`EmptyState`をvisual正本とする。
- DB/Storage: module repository/adapterを正本とし、presentationから直接clientを生成しない。
- Feature Flag: `src/lib/feature-flags/`に名前、default、対象面だけを集約する候補。ただし環境変数名とdefault falseは不変。

## 5. module依存関係

推奨方向は`App Router / Server Action -> application -> domain port -> repository/infrastructure`。`src/lib`の横断utilityはdomain判断を持たず、module同士を逆向きにimportしない。UI componentはapplication/repositoryを直接importしない。service-role clientはserver-only infrastructureまたはcomposition rootだけに置く。

## 6. 外部契約

以下はR3全体で不変とする。

- URL、HTTP method、request/response、status、Form field、redirect先、query名とmessage/error encoding
- DB table/column、migration履歴、RPC名・引数・戻り値、RLS、owner条件
- Storage bucket/path/content type、signed URL条件とTTL
- Feature Flag名、default、環境変数、Preview/Production解釈
- Provider、model、pricing、credit、retry、timeout、Scheduler、lease、idempotency、rate limit
- Canvas schema、PDF/PNG/package内容
- 成人向け/一般向け境界、Desktop protocol

## 7. service-role直接利用

`src/app/**`に32ファイルある。個別の認証・owner順序、用途、分類、移行先は[SUPABASE_ADMIN_CLIENT_AUDIT.md](./SUPABASE_ADMIN_CLIENT_AUDIT.md)に記録した。R3-3はこの台帳を減らすが、A分類のWorker composition rootまで機械的にゼロへすることを目的にしない。

## 8. 共通UI重複

候補はpending button、empty state、partial-data notice、error shell、status badge、loading skeleton、pagination、confirmation/action feedback、form field errorsの9分類。R3-4でvisual shellを共通化しても、CTA、reset範囲、log context、権限、partial/fatalの区別は各featureが保持する。

## 9. Feature Flag台帳

21個を確認した。すべて未設定時falseを維持する。

| 区分 | Flag |
|---|---|
| Planning/research | `CLOUD_ADULT_PLANNING_ENABLED`, `CLOUD_ADULT_RESEARCH_ENABLED`, `CLOUD_RESEARCH_MVP_ENABLED`, `CLOUD_RESEARCH_SEARCH_ENABLED`, `CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED` |
| Story production | `CLOUD_PROPOSAL_GENERATION_ENABLED`, `CLOUD_SCENARIO_GENERATION_ENABLED`, `CLOUD_STORYBOARD_GENERATION_ENABLED`, `CLOUD_STORYBOARD_CANVAS_ENABLED` |
| Image | `CLOUD_PANEL_IMAGE_GENERATION_ENABLED`, `CLOUD_PANEL_INPAINTING_ENABLED`, `CLOUD_PANEL_OUTPAINTING_ENABLED` |
| Monitor | `CLOUD_GENERAL_MONITOR_BETA_ENABLED`, `MANGAI_MONITOR_OPS_WORKER_ENABLED` |
| Cloud AI runtime | `MANGAI_CLOUD_AI_WORKER_ENABLED`, `MANGAI_CLOUD_EXPORT_WORKER_ENABLED`, `MANGAI_CLOUD_STORAGE_WORKER_ENABLED`, `MANGAI_CLOUD_IMAGE_ENABLED`, `MANGAI_CLOUD_TEXT_ENABLED`, `MANGAI_CLOUD_AI_MOCK_ENABLED` |
| Legacy kill switch | `MANGAI_ENABLE_LEGACY_LOCAL_TOOLS` |

module boundary検査で未参照flagの警告はない。R3-2では`.toLowerCase() === "true"`等の表記統一が挙動を変えないことをtable-driven testで固定する。

## 10. redirect/error契約

Auth callbackの`next`は`/update-password`だけを許可し、それ以外は`/dashboard`へ固定するためopen redirectではない。Actionは日本語message/errorを`encodeURI`または`encodeURIComponent`で付与し、`tests/action-redirect-encoding.test.mjs`が未encodingを検出する。APIは既存error contractを使用する。R3-1では現在のURL、query名、encoding結果、status/body、not-found/redirect/throwの選択を先にcharacterization testへ記録する。

## 11. 統合候補

1. 同一意味のUUID primitiveとFormData取得
2. allowlist型safe redirectとAction error mapping
3. Auth/admin/monitor guardのapplication入口規約
4. Feature Flag registry/read helper
5. presentationに残るmodule DB query
6. 共通UIのvisual shell
7. Worker secret比較、audit port、rate-limit interface、signed URLの低水準adapter

## 12. 統合禁止

domain固有のowner条件、Provider readiness、成人向け境界、rate-limit値、signed URL policy、audit event schema、Route/Action error response、Storage path、Worker lease/retry、UI reset範囲は単一の汎用関数へ統合しない。

## 13. characterization test

- redirect URL/query/encoding snapshotと悪意あるexternal `next`
- UUID不正時のstatus、notFound、redirect、error文言
- admin/profile/monitor guard未成立時にrepositoryが呼ばれないこと
- service role queryのowner filter/RPC actor引数
- 全21 flagのunset/`true`/大小文字/その他値
- signed URLのbucket/path/TTL/owner拒否
- Worker secretのmissing/wrong/correct時status/body
- Action/RouteのDB・Provider errorがraw露出しないこと
- pending/empty/partial/error UIのアクセシビリティと既存文言

## 14. PR分割

| PR | 範囲 | 明示的な除外 |
|---|---|---|
| R3-1 | Action/redirect/validationのcharacterizationと共通primitive | Auth、DB repository、UI redesign |
| R3-2 | Auth/owner/monitor guardとFeature Flag registry | RLS、flag名/default、admin query移動 |
| R3-3 | `src/app` admin clientをmodule repositoryへ移動 | DB/RPC変更、A分類composition rootの強制移動 |
| R3-4 | pending/empty/partial/error等の共通UI state | 情報設計、文言、URL、business state |
| R3-5 | Worker auth、audit port、rate-limit interface、signed URL低水準infra | policy値、Provider、Scheduler、Storage契約 |

R3-2またはR3-3が上限を超える場合は`a/b`へ分割し、認可とdata accessを同一PRで中途半端に跨がせない。

## 15. 変更ファイル見込み

| PR | 見込み |
|---|---:|
| R3-1 | 18〜28 files |
| R3-2 | 20〜35 files |
| R3-3 | 35〜50 files/PR（必要ならadmin、dashboard/desktopで分割） |
| R3-4 | 20〜35 files |
| R3-5 | 18〜32 files |

## 16. 行数見込み

| PR | churn見込み |
|---|---:|
| R3-1 | 600〜1,000 lines |
| R3-2 | 800〜1,300 lines |
| R3-3 | 1,000〜1,500 lines/PR |
| R3-4 | 700〜1,200 lines |
| R3-5 | 700〜1,300 lines |

各PRは50ファイル以下、1,500 churn以下、revert可能な1 commitを原則とする。

## 17. rollback

各PRを単独revertする。互換entrypoint/re-exportを移行PR内で保持し、次PRでのみ利用側を切り替える。DB/migration/Storage data変換を伴わないためdata rollbackは不要。flag helper移行時も既存env名を直接読める互換入口を残す。

## 18. リスク

最大リスクはservice-role owner filter欠落、redirect/error表現変更、flag default差、signed URL policy混同、汎用化による成人向け境界越えである。対策はcharacterization先行、小PR、domain policy非統合、owner isolation/acceptanceの毎PR実行。

## 19. 外部受入れ

実Provider受入れはPR-R2C後に完了済み。R3はProvider/model/pricingを変更しないため、有料Provider生成は各PRで行わない。R3-5完了後、Provider呼出し境界へ実質変更がないことをdiffで確認し、必要な場合だけ責任者承認の下で一般向け背景1件を再受入れする。Supabase staging owner isolation、Vercel Preview、Desktopは該当PRごとに確認する。

## 20. PR-R4へ進む前の停止条件

- R3-1〜R3-5の全Draft PRが個別に責任者承認・merge済み
- 全CI、Vercel Preview、owner isolation、Cloud漫画repository/longform受入れ成功
- `deps:check` error 0、admin client warningが承認済み残件だけ
- URL/API/DB/RPC/Storage/flag/Provider/Canvas/PDF/PNG/Desktop契約差分0
- service-role利用に認証/owner根拠と分類がある
- open redirect、raw error露出、成人向け境界越えがない
- CURRENT_TASK/HANDOFF/台帳が実装後の状態へ同期済み
- 責任者がR3完了を明示承認するまでR4を開始しない

