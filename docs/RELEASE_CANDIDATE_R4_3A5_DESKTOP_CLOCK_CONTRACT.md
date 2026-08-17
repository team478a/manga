# RELEASE CANDIDATE: PR-R4-3A-5 prerequisite Desktop期限契約

作成日: 2026-08-17

状態: `IMPLEMENTED_LOCAL / CI_PENDING / PRODUCTION_FAIL_CLOSED_UNCHANGED`

## 1. 原因

2026-08-17 00:00 UTCに既存`DEZGO_PRICING_VALID_UNTIL`とテスト用成人Provider policyが同時失効した。PR #296のCore qualityとWindows buildは、再実行を含め次の同じ4テストで停止した。

- safe asset jobs prefer project library and never require external access
- adult provider evidence and model allowlist persist fail closed
- adult provider policy stops disallowed pending Dezgo jobs and releases reservations
- guarded Dezgo dispatcher handles lifecycle and billing with mocked output

本番の期限切れ判定は正しいfail-closedである。一方、成功系テストが実行日の壁時計へ依存していたため、コード差分なしで期限当日に失敗する状態だった。

## 2. 修正

- `AIService`へoptionalな`now`関数を追加し、Dezgo費用guardへ渡す。
- 成人Provider policy状態取得とbundle適用へoptionalな`referenceTime`を追加する。
- 該当成功系テストだけ契約有効期間内の`2026-07-18T00:00:00.000Z`を明示する。
- Productionの呼出しは引数を省略し、従来どおり現在時刻を使用する。

## 3. 不変契約

次を変更しない。

- `DEZGO_PRICING_VERSION`
- `DEZGO_PRICING_VALID_UNTIL`
- 価格、25%安全余裕、費用上限
- Provider、model、endpoint、retry、timeout
- 成人Provider policy payload、署名、allowlist、失効判定
- DB schema、migration、API、IPC、Storage、Production、credit

期限後のProduction費用guardは引き続き`pricing_stale`で停止し、失効した成人Provider／modelは引き続き拒否する。

## 4. 検証

- Dezgo conservative cost guard: 1/1
- signed adult provider policy: 1/1
- dependency／module boundary: 成功
- lint: 成功
- Hub typecheck: 成功
- Hub: 778/778
- Canvas: 26/26
- AI: 48/48
- migration: 59本
- Webpack Hub production build: 成功
- RC structure preflight: 成功

Desktopローカルは既知の`@napi-rs/keyring`型宣言不足とElectron／better-sqlite3 native binary不在で実行できないため、GitHub Linux／Windows CIを正式結果とする。

## 5. rollback

このPRをrevertすると、Production挙動は変わらないが、期限後に成功系Desktopテストが壁時計依存で再び失敗する。DB rollbackやデータ操作は不要。

## 6. 停止条件

Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments成功後に停止する。自動mergeせず、PR #296へrebase／force pushせず、R4-3Bへ進まない。
