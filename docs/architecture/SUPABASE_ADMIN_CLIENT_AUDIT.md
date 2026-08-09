# Supabase Admin Client Audit

## 判定基準

- A: 信頼済みserver-to-server経路として安全
- B: 認証・owner確認後に必要
- C: module repositoryへ移すべき
- D: browser RLS clientへ戻すべき
- E: 契約判断が必要

`npm run deps:check`が報告する`src/app/**`の直接利用は32ファイル。今回の監査では、認証されていない利用者入力だけで任意のownerデータへ到達する経路は確認されなかった。Dに確定できる経路もない。admin clientをbrowserへ戻す判断はRLSと戻り値契約の実証後に限る。

## 実装進捗

- PR-R3-3a: 成人向け研究管理と更新情報管理の5ファイルをrepositoryへ移し、32件から27件へ削減した。
- PR-R3-3b: 一般モニター管理の一覧、feedbackレビュー、メール監査、CSV、利用者別招待操作の5ファイルを`src/modules/general-monitor/infrastructure/admin-monitor-repository.ts`へ移し、27件から22件へ削減した。
- PR-R3-3c: モニターissue管理の一覧、関連feedback、添付署名URL、状態更新の2ファイルを`src/modules/monitor-operations/infrastructure/admin-monitor-issue-repository.ts`へ移し、22件から20件へ削減した。
- PR-R3-3d: 管理者ユーザー詳細の成人向け企画grant／成人向け市場分析entitlement更新2ファイルを各domain repositoryへ移し、20件から18件へ削減した。
- PR-R3-3e: 管理者ユーザー一覧・詳細とaccount停止／再開／soft deleteの3ファイルを`src/modules/account/infrastructure/admin-user-repository.ts`へ移し、18件から15件へ削減した。
- `src/app/api/internal/monitor-ops/worker/route.ts`はA分類のcomposition rootとして維持する。利用者feedback、Cloud AI、Desktop、checkout、購入履歴は後続の機能完結sliceまたは各分類の計画で扱う。

| File | Function | Auth確認 | Owner確認 | 用途 | 分類 | 推奨移行先 |
|---|---|---|---|---|---|---|
| `src/app/actions/checkout-actions.ts` | `createPendingOrder` | Supabase user取得 | user/profile由来でorder作成 | pending order作成 | B | checkout repository |
| `src/app/admin/adult-research/actions.ts` | `setCloudAdultResearchEnabledAction` | `requireAdmin` | admin操作対象 | 成人向けresearch設定 | C | adult-research admin repository |
| `src/app/admin/adult-research/page.tsx` | `AdminAdultResearchPage` | `requireAdmin` | admin scope | 設定読取 | C | 同上 |
| `src/app/admin/cloud-ai/actions.ts` | Cloud AI admin actions / `audit` | 各exportで`requireAdmin` | admin scope、job ID検証 | Worker実行、cancel、settings、plan、price、audit | C | cloud-ai admin application/repository |
| `src/app/admin/cloud-ai/page.tsx` | `CloudAiAdminPage` | `requireAdmin` | admin scope | job/settings/price読取 | C | cloud-ai admin repository |
| `src/app/admin/general-monitors/actions.ts` | `reviewGeneralMonitorFeedbackAction` | `requireAdmin` | RPC actor ID | feedback review | C | monitor admin repository |
| `src/app/admin/general-monitors/email/page.tsx` | `GeneralMonitorEmailSettingsPage` | `requireAdmin` | admin scope | email監査読取 | C | monitor admin repository |
| `src/app/admin/general-monitors/export/route.ts` | `GET` | `requireAdmin` | admin scope | CSV出力 | C | monitor export application/repository |
| `src/app/admin/general-monitors/page.tsx` | `GeneralMonitorsAdminPage` | `requireAdmin` | admin scope | monitor一覧 | C | monitor admin repository |
| `src/app/admin/monitor-issues/actions.ts` | `updateMonitorIssueTaskAction` | `requireAdmin` | admin scope | issue task更新 | C | monitor-ops repository |
| `src/app/admin/monitor-issues/page.tsx` | `MonitorIssuesAdminPage` | `requireAdmin` | admin scope | issue task一覧 | C | monitor-ops repository |
| `src/app/admin/product-updates/actions.ts` | create/change/edit actions | `requireAdmin` | admin scope | product update CRUD | C | product-update repository |
| `src/app/admin/product-updates/page.tsx` | loader / page | pageで`requireAdmin` | admin scope | update一覧 | C | product-update repository |
| `src/app/admin/product-updates/[updateId]/edit/page.tsx` | loader / page | pageで`requireAdmin` | UUID＋admin scope | update詳細 | C | product-update repository |
| `src/app/admin/users/account-actions.ts` | manage/suspend/restore/delete | `requireAdmin` | self/target管理可否確認 | account operation | C | account admin application/repository |
| `src/app/admin/users/page.tsx` | `AdminUsersPage` | `requireAdmin` | actor除外等 | user一覧 | C | account admin repository |
| `src/app/admin/users/[id]/adult-feature-actions.ts` | `setCloudAdultPlanningGrantAction` | `requireAdmin` | target UUID | adult planning grant | C | entitlement repository |
| `src/app/admin/users/[id]/adult-research-actions.ts` | `setCloudAdultResearchEntitlementAction` | `requireAdmin` | target UUID | adult research entitlement | C | entitlement repository |
| `src/app/admin/users/[id]/general-monitor-actions.ts` | activate/resend/stop＋補助関数 | export入口で`requireAdmin` | target UUID、RPC actor | monitor招待・停止 | C | monitor admin application/repository |
| `src/app/admin/users/[id]/page.tsx` | `AdminUserDetailPage` | `requireAdmin` | target ID | user詳細 | C | account admin repository |
| `src/app/api/desktop/device/authorize/route.ts` | `POST` | device code/token検証 | code対象profile | device認可 | A | desktop-device application/repository |
| `src/app/api/desktop/device/token/route.ts` | `GET`/`DELETE` | token検証 | token対象device/profile | token poll/revoke | A | desktop-device repository |
| `src/app/api/desktop/projects/[sourceProjectId]/status/route.ts` | `PATCH`/`GET` | device authorization helper | deviceとproject対応 | Desktop同期状態 | C | desktop project repository |
| `src/app/api/internal/cloud-ai/worker/route.ts` | `GET`/`POST` | timing-safe Worker secret | job lease内で保持 | readiness/worker実行 | A | cloud-ai worker composition root |
| `src/app/api/internal/monitor-ops/worker/route.ts` | `POST` | timing-safe Worker secret | task ID | monitor ops worker | A | monitor-ops worker composition root |
| `src/app/checkout/cancel/page.tsx` | `CheckoutCancelPage` | signed checkout state | state内order | cancel表示/order確認 | E | checkout query repository（署名契約を先に固定） |
| `src/app/checkout/success/page.tsx` | `CheckoutSuccessPage` | signed checkout state | state内order | success表示/order確認 | E | checkout query repository（署名契約を先に固定） |
| `src/app/dashboard/devices/actions.ts` | approve/revoke | `requireProfile` | profile ID | device承認・取消 | B | desktop-device application/repository |
| `src/app/dashboard/devices/authorize/page.tsx` | `AuthorizeDevicePage` | `requireProfile` | code対象確認 | device認可画面 | B | desktop-device query repository |
| `src/app/dashboard/devices/page.tsx` | `DevicesPage` | `requireProfile` | `.eq(profile_id)` | device一覧 | B | desktop-device query repository |
| `src/app/dashboard/monitor/actions.ts` | `submitCloudGeneralMonitorFeedbackAction` | `requireProfile`＋monitor entitlement | profile由来ID | feedback/attachment保存 | B | monitor feedback application/repository |
| `src/app/dashboard/purchases/page.tsx` | `PurchasesPage` | `requireProfile` | `.eq(profile_id)` | 購入履歴 | B | purchase query repository |

## 移行時の必須条件

1. `requireAdmin`、`requireProfile`、device/Worker secret検証をrepository呼出しより前に維持する。
2. owner IDはURL/FormDataから信頼せず、認証済みprofile/device/署名済みstateから渡す。
3. `.eq("profile_id", ...)`、RPC actor引数、not-found表現、status/body/redirectをcharacterization testで固定する。
4. service roleの生成を共通化しても、browser bundleへexportしない。
5. Eは署名stateの改ざん・期限切れ・別order試験が揃うまで移動しない。

