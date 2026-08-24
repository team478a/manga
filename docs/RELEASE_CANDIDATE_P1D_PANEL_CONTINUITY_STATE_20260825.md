# P1-D コマ連続状態 Release Candidate

## 結論

P1-Dとして、人物・場所・小物のコマ単位の連続状態を構造化保存し、単一コマ生成とbatch生成の共通入力へ固定した。Production、Provider、Worker実行、Job実行、Storage、credit予約・消費は変更していない。

## 基準

- Base: PR #346 merge commit `9c80cbca16eb4ff817ee6549df4cf9555a9b261f`
- Branch: `codex/p1d-panel-continuity-state`
- Migration: `202608250003_cloud_panel_continuity_states.sql`（manifest 69件）

## 実装

- project／page／panel／subject単位で時間帯、天候、状態、持ち手、画面内左右、視線、継続元panelを保存する。
- owner RLSとowner RPCを適用し、対象subject、対象panel、継続元panelが同一作品の現行データに存在することをDBで検証する。
- 既存の参照画面から保存・解除でき、migration未適用時は連続状態UIだけを安全に停止する。
- 生成準備時に当該panelの状態を最大12件解決し、構造化`panelContinuityStates`と変更禁止prompt断片をJob入力へ保存する。
- 既存生成経路、Provider選択、model、料金、参照resolverは維持する。
- 状態行が存在する場合はrollbackを停止し、情報損失を防ぐ。

## 検証

- 集中テスト: 6/6
- Hub: 854項目／858 tests
- Canvas: 26/26
- AI Core: 48/48
- Desktop: 182/182
- Desktop a11y: violation 0
- migration: 69件の静的検査、PostgreSQL 16 forward／rollback／reapply、canonical schema二重適用
- deps、lint、Hub／Desktop型検査、Hub／Desktop build、RC structure、`git diff --check`

## 運用境界

- Production変更なし
- Provider実行なし
- credit予約・消費なし
- 本PRのmigration適用やFeature有効化は行わない

## 次候補

merge後にP1-E（生成結果へcharacter version／reference／provider／model／seed／workflow versionの追跡情報を集約する）を別PRで開始する。
