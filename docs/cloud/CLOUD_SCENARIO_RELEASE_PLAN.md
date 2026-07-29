# MANGAI Cloud シナリオ生成 Release 3 計画

作成日: 2026-07-29
対象ブランチ: `codex/cloud-scenario-mvp`
依存ブランチ: `codex/cloud-proposal-mvp`（Draft PR #51）

## 1. 目的

採用済みの企画snapshotだけを入力にし、漫画制作で次工程へ渡せるページ配分付きシナリオを生成・保存・改稿・再表示・確定できる縦型機能を完成させる。

Release 1／2の実環境受入れは外部環境待ちとして残す。Release 3はstacked branchで先行実装し、依存PRと各Releaseの受入れが完了するまでmergeしない。

## 2. 実装順

1. 企画採用snapshotの所有権と固定状態を確認
2. 元市場分析Reportからページ数と制作条件を再取得
3. 初稿シナリオを生成し、版番号1として保存
4. シナリオ履歴と詳細を再表示
5. 改稿方針を選び、親Runを保持した新しい版を生成
6. 1つの版を確定snapshotとして固定
7. Release 4「マンガ生成」への引継ぎ条件を表示

## 3. 生成方式

- 初期engineは`scenario-rules-v1`。
- 外部Providerを呼ばず、採用企画と市場分析の制作条件だけから再現可能な構造を作る。
- 初稿と改稿はすべてimmutableなRunとして保存する。
- 改稿は`pacing`、`character`、`clarity`の3方針を選べる。
- シーンのページ範囲は1Pageから元Reportのページ数まで連続させる。
- 出典URLはシナリオの事実根拠ではなく、企画に至った市場分析への追跡情報として保持する。
- 将来のCloud Text Provider接続は生成interfaceの別実装とし、版管理・確定契約を変更しない。

## 4. Feature Flag

`CLOUD_SCENARIO_MVP_ENABLED`

- 未設定／`false`: fail closed
- `true`: Release 3画面とServer Actionを有効化
- Release 1／2のFeature Flagと各migrationが有効であることも必須

## 5. 完了条件

- 未採用企画からシナリオを生成できない。
- 一般向けの所有データだけを処理する。
- 初稿生成 → 保存 → 履歴 → 再表示 → 改稿 → 版確定が完走する。
- 版番号は企画採用ごとに単調増加し、同時生成でも重複しない。
- 確定できる版は企画採用ごとに1件だけ。
- 所有者以外はRunと確定結果を参照・作成できない。
- 390px／768px／1280pxでシーン一覧と改稿操作を利用できる。
- lint、typecheck、Hub test、migration検証、production build、CIが成功する。

## 6. 今回変更しない範囲

- Cloud AI Queue／Worker／Provider Gateway
- Cloud Canvas Editor
- 漫画画像・コマ・吹き出し生成
- Stripe／Marketplace
- Desktop
- 成人向け製品境界

## 7. Merge条件

- Draft PR #50／#51の依存関係が解消している。
- Release 1〜3の実環境E2E、RLS、レスポンシブ確認が完了している。
- 全CI成功と責任者承認が揃っている。
