# Cloud Storyboard Generation v1

## 入力

- 所有者本人の採用済み`cloud_story_scenario_versions`
- 対応する一般向け市場分析Report
- 対応する採用企画snapshot
- 修正時のみ親ネーム版と2000文字以内の修正指示

## 出力

`openai-storyboard-v1`として次を保存する。

- タイトル、総ページ数、右綴じ
- ページ番号、対応シーン、ページ目的、ページ送りフック
- コマ番号、ショット、カメラ角度、構図、登場人物、背景、動作、感情
- セリフ・心の声・ナレーション
- 一般向け画像生成に使える構図説明
- ページリズム、視覚モチーフ、連続性リスク

ページは1から連番、コマはページ内で1から連番とする。総ページ数は採用シナリオと一致させる。

## 版管理

- 初稿・修正版は`cloud_story_storyboard_versions`へ追記
- 親版は`parent_version_id`で保持
- 採用操作は`cloud_story_storyboard_adoptions`へ追記
- 過去版は更新・削除しない

## 安全境界

- `CLOUD_STORYBOARD_GENERATION_ENABLED=true`の場合だけ実行
- 一般向け・採用済みシナリオだけを外部AIへ送信
- OpenAI Responses APIは`store:false`
- profile IDはSHA-256化して`safety_identifier`へ設定
- 市場数値を新規生成せず、売上を保証しない
- 応答サイズ、timeout、JSON Schema、Zod schemaを検証
- APIキー、創作内容、内部エラーをログへ保存しない
