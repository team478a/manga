# RELEASE CANDIDATE: 完成判定の手動確認理由可視化

作成日: 2026-08-20

基準: PR #319 merge commit `10f7b5c61efd755b405fb5f3a2c52861b2e74b3c`

Branch: `codex/fix-r4-3-completion-review-reasons`

## Production受入れ

PR #319のmerge commitがVercel Productionへ反映済みであることを確認し、`test`の既存22ページをread-onlyで再読込した。

- 画像: 4/4
- セリフ: 1/1
- 生成中: 0
- 失敗: 0
- Canvas revision: 保存済み11／現在11
- PNG: 成功
- credit: 使用80、予約0、残り20
- 完成表示: 「手動確認待ち」
- blocker表示: 「自動配置結果に確認が必要です。」

Production作品、Canvas、DB、Storage、品質記録への書込み、Provider実行、生成、credit消費は行っていない。

## 契約監査

genericな手動確認flagは次の3系統をORしていた。

1. `cloud_page_dialogue_placements.status`が`review_required`または`placement_failed`
2. `cloud_pages.production_status`が`revision_required`
3. 現在のコマ生成単位に未解決の`cloud_generation_panel_adoptions.status`がある

セリフ配置台帳は`page_id`主キーでページ単位に一意である。ページ制作状態の通常の`review_required`はこの完成guardへ含めず、明示的な要修正である`revision_required`だけを含める。

## 修正契約

- `review_required`のセリフ配置は「自動配置したセリフに確認が必要です。」と表示する。
- `placement_failed`は「セリフの自動配置に失敗しています。」と表示する。
- ページの`revision_required`は「ページ制作状態が『要修正』です。」と表示する。
- 未解決の候補採用は「コマの画像候補採用に確認が必要です。」と表示し、panel／generation Jobの関連付けを保持する。
- 原因別情報のない既存呼出しでは従来のgeneric文言へfallbackする。
- 完成状態、回帰guard、外部API response schemaは変更しない。

## 変更しない契約

API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。

## ローカル検証

- 集中テスト: 18/18
- dependency boundary: error 0（既存warning 2件）
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub: 827/827
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: exit 0、violation 0
- migration validation: 61件
- Hub build: 成功
- Desktop build: 成功
- RC preflight: Repository structure READY
- RC外部設定: ローカルに秘密情報を置かない既存方針のためPENDING
- diff check: 成功

## merge後の受入れ

追加Provider実行・追加課金なしで対象22ページを再読込し、手動確認理由を特定する。表示された原因以外を推測で変更しない。

1. 原因別メッセージが表示される。
2. 画像4/4、セリフ1/1、生成中0、失敗0を維持する。
3. Canvas revision 11を維持する。
4. PNG成功を維持する。
5. credit使用80・予約0・残り20を維持する。

Production DB、作品、Canvas、画像、品質記録を手動更新して判定を合わせてはならない。

## Draft PR／Preview

- Draft PR: 未作成
- CI: 未実行
- Preview: 未作成
- Production変更: 0件
