# MANGAI Cloud 出典検証基盤 実装計画

作成日: 2026-07-29

## 目的

市場分析へ登録するURLをServerで安全に取得し、実在する取得結果のmetadataと本文hashをReportへ保存する。検索ProviderやLLMが未検証URLを根拠として扱わないための境界を作る。

## 今回の範囲

- 環境変数で明示した許可ドメインだけを取得
- HTTPS、認証情報なし、443番portのみ
- DNS解決結果のpublic IP確認
- redirectごとのURL・host・DNS再検証
- timeout、応答容量、Content-Type制限
- streamingによる1MB上限
- 最終URL、検証日時、MIME、byte数、SHA-256、HTML titleの保存
- 検証済み件数をResearch Quality v2 scoreへ反映
- Feature Flag未設定時は既存の手入力フローを維持

## 今回変更しないもの

- 検索API契約
- URL本文の長期保存
- 本文をLLMへ送信する処理
- 事実メモとの自動含意判定
- PDF、画像、動画の取得
- robots.txtや有料記事の回避

## 次段階

1. 検索Providerが返した候補URLを同じ検証境界へ通す。
2. robots・利用規約・取得許可記録を追加する。
3. 検証済み本文の短期snapshotとclaim抽出を追加する。
4. 複数出典の一致・相反を評価する。
5. 引用必須LLMとgolden set evalを追加する。

## 完了条件

- private／loopback IP、未許可host、危険redirectを取得しない。
- 1MB超、非対応MIME、timeout、異常statusを安全に拒否する。
- 検証metadataだけをReportへ保存し、本文をDBへ保存しない。
- Feature Flag無効時の既存フローとv1/v2 Report表示を維持する。
