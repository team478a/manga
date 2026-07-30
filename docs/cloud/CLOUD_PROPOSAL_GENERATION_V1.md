# Cloud Release 2: AI企画提案

## 目的

完了した一般向け市場分析から、利用者が市場用語や生成設定を意識せず、制作する漫画企画を決定できるようにする。

## 利用者フロー

1. 市場分析Reportの「AI企画提案へ進む」を開く
2. 「AI企画を3案作成」を実行
3. 本命案・差別化案・小さく試す案を比較
4. 売れやすさ・作りやすさ・独自性と企画内容を確認
5. 1案を選択して保存
6. Release 3のシナリオ生成へ引き継ぐ

## 実装境界

- 市場分析で保存済みの結果のみを企画生成へ渡し、Web検索は再実行しない
- 管理画面で設定済みのOpenAI接続をSupabase Vault経由で再利用する
- API key、出典URL、内部評価ロジックは利用者画面へ表示しない
- 成人向けReportは外部AIへ送信せず、既存の許可制手動企画ブリーフを維持する
- 売上を保証せず、市場分析にない市場数値を生成しない

## Feature Flag

`CLOUD_PROPOSAL_GENERATION_ENABLED=true`

未設定または`true`以外の場合、企画RunのDB参照・生成・選択を停止する。

## DB

- `cloud_story_proposal_runs`: 3企画と生成情報
- `cloud_story_proposal_selections`: 選択した企画の不変snapshot

両テーブルは所有者RLSを有効化し、別ユーザーの参照を拒否する。

## 公開前手順

1. `202607300002_cloud_story_proposals.sql`をstagingへ適用
2. Vercel Previewの対象ブランチだけにFeature Flagを設定
3. 管理画面の市場分析AI接続が有効であることを確認
4. 一般向け市場分析から3案生成、再表示、選択を確認
5. 成人向けReportが外部AI生成へ入らないことを確認
