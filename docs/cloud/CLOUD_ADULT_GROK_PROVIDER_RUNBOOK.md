# Cloud成人向けGrok Provider 限定公開Runbook

## 適用前

1. xAIの法人・商用API条件と対象コンテンツが許容されることを責任者が確認する。
2. Draft PRの全CI、Preview、差分、成人向け安全テストを確認する。
3. `npm run cloud:adult-grok:preflight`を実行する。秘密値は出力されない。

## Preview設定順

1. Supabase SQL Editorで`202607310001_cloud_adult_grok_provider.sql`を適用する。
2. `/admin/adult-grok`を開く。
3. xAI Consoleで発行したAPIキーを入力し、まずDB側実行状態は「停止」で保存する。
4. Vercel Previewの対象ブランチだけに`CLOUD_ADULT_GROK_ENABLED=true`を設定する。
5. Redeployする。
6. `/admin/adult-grok`で環境Feature Flagが有効、APIキーが設定済みであることを確認する。
7. DB側実行状態を有効にする。
8. 既存の成人向け限定モニター1名で市場分析→企画→シナリオ→ネームを確認する。

APIキーはVercelへ登録しない。Supabase Vaultだけを正本にする。

## 確認

- 一般向け市場分析・企画は従来どおり動く
- 成人向け市場分析が保存・履歴再表示できる
- 採用した成人向け分析から企画・シナリオ・ネームへ進める
- 未許可ユーザー、同意未完了、上限到達、期限切れはProvider前に拒否される
- 未成年、実在人物、非同意などの入力と出力は拒否される
- APIキー、prompt、Provider error本文がログとUIへ出ない
- 成人向け画像生成は利用できない

## 緊急停止

1. `/admin/adult-grok`のDB側実行状態を「停止」にする。
2. 必要ならVercel Previewの`CLOUD_ADULT_GROK_ENABLED`を`false`にしてRedeployする。
3. 成人向け限定モニターを停止する。
4. APIキー漏えいが疑われる場合はxAI Consoleで失効し、Vaultへ新しいキーを保存する。

## Rollback

生成済みxAIレコードまたはVault secretが残る場合、rollbackは安全のため失敗する。先に責任者承認を得て対象データとVault secretの扱いを決める。破壊的削除を自動実行しない。
