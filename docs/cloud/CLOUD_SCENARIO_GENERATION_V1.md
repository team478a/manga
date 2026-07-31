# Cloud Scenario Generation v1

## 入力契約

- `cloud_story_proposal_selections`に保存された採用企画snapshot
- 所有者本人の完了済み一般向け市場分析Report
- 市場分析の制作条件と結果要約
- 修正時のみ、親シナリオ版と利用者の修正指示

自由入力や保存後の市場分析から企画内容を再構成せず、採用snapshotを正本とする。

## 出力契約

`openai-scenario-v1`は次を構造化して保存する。

- タイトル、1行あらすじ、想定ページ数
- 登場人物2〜6名（主人公は1名）
- 導入・対立・解決の三幕構成
- 6〜20シーン（ページ範囲、目的、要約、感情、フック、会話目標）
- 冒頭フック、読者への報酬、差別化、制作リスク

市場分析に存在しない販売数、成長率、順位などの数値は生成しない。

## 版管理

- 初稿も修正版も`cloud_story_scenario_versions`へ追記する
- 修正版は`parent_version_id`で親を参照する
- 過去版を更新・削除しない
- 採用操作は`cloud_story_scenario_adoptions`へ追記する
- 最新の採用eventを現在の採用版とする

## 安全境界

- `CLOUD_SCENARIO_GENERATION_ENABLED=true`の場合だけ有効
- 一般向け企画のみ外部AIへ送信
- OpenAI Responses APIは`store: false`
- `safety_identifier`はprofile IDをSHA-256化
- 応答サイズ、timeout、JSON Schema、Zod schemaをすべて検証
- APIキー、内部Provider応答、DBエラーを画面やログへ表示しない
- 利用者単位とglobalのrate limitをProvider呼び出し前に適用

## Release 4への引継ぎ

採用eventが存在する場合だけ「マンガ生成の準備完了」とする。
Release 4は採用されたシナリオ版のimmutable resultを入力にする。
