# MANGAI Cloud AI企画提案 Release 2 計画

作成日: 2026-07-29
対象ブランチ: `codex/cloud-proposal-mvp`
依存ブランチ: `codex/cloud-research-mvp`（Draft PR #50）

## 1. 目的

完了した市場分析Reportを制作条件として引き継ぎ、一般向け漫画の企画候補を生成・保存・比較・再表示・採用できる縦型機能を完成させる。

Release 1のSupabase／Vercel実環境受入れは外部環境待ちとして残す。Release 2はstacked branchで実装し、依存PRと各Releaseの受入れが完了するまでmergeしない。

## 2. 実装順

1. 市場分析Reportの所有権と完了状態を確認
2. Reportの入力・推奨条件・出典参照から3件の企画候補を生成
3. 生成Runと候補をimmutableに保存
4. 企画履歴と詳細を再表示
5. 3候補を比較し、1件だけ採用
6. 採用済み企画をRelease 3「シナリオ生成」の入力契約として固定

## 3. 生成方式

- 初期engineは`proposal-rules-v1`。
- 外部Providerを呼ばず、入力条件と市場分析結果だけから再現可能な構造化候補を作る。
- 各候補は市場分析Reportと出典URLへの参照を保持する。
- 市場数値、販売予測、成長率を新しく生成しない。
- 推論は企画仮説として明示し、事実のように表示しない。
- 将来のCloud Text Provider接続は生成interfaceの別実装とし、保存・履歴・採用契約を変更しない。

## 4. Feature Flag

`CLOUD_PROPOSAL_MVP_ENABLED`

- 未設定／`false`: fail closed
- `true`: Release 2画面とServer Actionを有効化
- Release 1 flagと新規migrationが有効であることも必須

## 5. 完了条件

- 完了Report以外から企画生成できない。
- 一般向けReportだけを処理する。
- 生成 → 保存 → 履歴 → 再表示 → 採用が完走する。
- 所有者以外はRunと採用結果を参照・作成できない。
- 同一Runで採用できる候補は1件だけ。
- 採用後は差し替えず、別案が必要な場合は新しい市場分析／企画Runを作る。
- 390px／768px／1280pxで比較・詳細画面が利用できる。
- lint、typecheck、Hub test、migration検証、production build、CIが成功する。

## 6. 今回変更しない範囲

- Cloud AI Queue／Worker／Provider Gateway
- Cloud Canvas Editor
- シナリオ本文生成
- マンガ生成
- Stripe／Marketplace
- Desktop
- 成人向け製品境界

## 7. Merge条件

- Draft PR #50の依存関係が解消している。
- Release 1とRelease 2の実環境E2E、RLS、レスポンシブ確認が完了している。
- 全CI成功と責任者承認が揃っている。
