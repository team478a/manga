# Release Candidate RC Ledger Reconciliation（2026-08-28）

状態: `LEDGER_RECONCILED / INITIAL_USER_READINESS_PASSED / RELEASE_WIDE_11_PENDING_2_BLOCKED`

## 目的

直近のProduction BFL受入れと隔離Staging durable export受入れを、`docs/desktop/RC_ACCEPTANCE_STATUS.json`へ証跡付きで反映する。初期ユーザー向け完了条件と、製品全体のrelease-wide gateを混同せず、未検証項目を完了扱いにしない。

## 整合結果

| 区分 | 件数 | 判定 |
| --- | ---: | --- |
| passed | 3 | ローカル品質、Desktopローカル、初期ユーザー向けP0〜P4受入れ |
| pending | 11 | 実機・外部環境・決済・公開環境の追加受入れ |
| blocked | 2 | コード署名証明書と署名済み自動更新環境待ち |

初期ユーザー向けP0〜P4受入れは、Production migration／BFL原価guardと隔離Staging durable exportの完了により7/7成功として追加した。これはrelease-wideの全ゲート完了を意味しない。

## 維持した残件

- Windows Narrator（日本語／英語）、高コントラスト、表示倍率150%。
- Ollama、ComfyUI、Dezgo非成人向け10枚の実環境E2E。
- Hub stagingとDesktop端末認証E2E、Stripe test E2E。
- クリーンWindows最終受入れ。
- Hub ProductionのCloud text model・pricing・Gateway実Job、AIネーム由来8ページProduction E2E、一般ユーザー所有成果物と署名付き書き出しURLのowner isolation。
- 信頼されたWindowsコード署名証明書、署名済み2 versionと公開更新URL。

## 更新内容

- 台帳日付を`2026-08-28`へ更新した。
- 最新の全ローカル品質ゲート実績を反映した。
- `initial-user-readiness`をpassedとして証跡3文書へ接続した。
- `hub-production-acceptance`はpendingを維持し、既に完了した初期ユーザー向け受入れと残るProduction固有項目を明確に分離した。
- 自動テストで件数、主要状態、証跡、残件理由を固定した。

## 安全境界

本作業はrepository内の台帳・テスト・引継ぎ文書だけを更新する。Production、Supabase、Vercel、Provider、生成Job、Asset、credit、決済、利用者データへの操作は行わない。

## 検証結果

- 集中台帳テスト 1/1。
- Hub 917/917、Canvas 26/26、AI 48/48、Desktop 182/182。
- Desktop accessibility 29画面、violation 0。
- Supabase migration 74件。
- dependency boundary、lint、Hub／Desktop型検査、Hub／Desktop production build、RC structure、`git diff --check`成功。
- `rc:preflight`の外部設定・手動E2Eは、今回変更していないrelease-wide gateとしてpendingを維持した。

## 正本証跡

- `docs/RELEASE_CANDIDATE_P0_P4_CLOSEOUT_AUDIT_20260826.md`
- `docs/RELEASE_CANDIDATE_PRODUCTION_BFL_ACCEPTANCE_CLOSEOUT_20260827.md`
- `docs/RELEASE_CANDIDATE_STAGING_DURABLE_EXPORT_ACCEPTANCE_CLOSEOUT_20260827.md`
