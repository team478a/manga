# Cloud成人向けAIネーム v1 実装計画

## 目的

許可された成人利用者が、採用済み成人向けシナリオからページ・コマ単位のネームを生成し、修正、履歴確認、採用まで完走できるようにする。一般向けの保存・RLS・Canvas経路へ混入させない。

## 実装範囲

1. `adult_storyboard`専用の環境Feature Flag、DB Kill Switch、個別許可、本人同意
2. 市場分析、シナリオ、修正元、保存版の`content_class`一致
3. OpenAI送信前と結果保存前の成人向け安全検査
4. 初稿、修正版、履歴、再表示、採用
5. 管理者の全体停止とユーザー別許可
6. 成人向けCanvas・画像生成の明示停止
7. forward、rollback、canonical schema、preflight、自動テスト

## 安全境界

- 登場人物は架空かつ明示的に18歳以上
- 合意のある非搾取的な関係のみ
- 未成年、年齢不詳、実在人物、非同意、搾取的内容を拒否
- APIキーは既存Supabase Vault設定を再利用し、画面、URL、ログ、通常テーブルへ出さない
- Provider requestは`store: false`
- 未知のDB／Provider error詳細を利用者へ出さない
- 成人向けネームから一般向けCanvasを作成しない

## 停止条件

Draft PRとPreviewを作成し、CI結果を確認した時点で停止する。migration適用、Feature Flag有効化、有料API実行、PR merge、本番公開は行わない。
