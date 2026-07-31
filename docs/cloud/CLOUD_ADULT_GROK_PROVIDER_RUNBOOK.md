# Cloud成人向けGrok Provider 限定公開Runbook

## 適用前

1. xAIの法人・商用API条件と対象コンテンツが許容されることを責任者が確認する。
2. Draft PRの全CI、Preview、差分、成人向け安全テストを確認する。
3. `npm run cloud:adult-grok:preflight`を実行する。秘密値は出力されない。

## Preview設定順

1. Supabase SQL Editorで`202607310001_cloud_adult_grok_provider.sql`を適用する。
2. `/admin/adult-grok`を開く。
3. xAI Consoleで発行したAPIキーを入力して「APIキーを保存して利用開始」を押す。
4. 「利用できます」と表示されることを確認する。
5. 既存の成人向け限定モニター1名で市場分析→企画→シナリオ→ネームを確認する。

APIキーを変更するときも、同じ画面へ新しいキーを入力して保存する。保存後から新しいキーが使われる。

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

1. 成人向け限定モニターを停止する。
2. 緊急時はDBの`cloud_adult_grok_settings.enabled`を`false`へ変更する。
3. APIキー漏えいが疑われる場合はxAI Consoleで失効し、管理画面へ新しいキーを保存する。

## Rollback

生成済みxAIレコードまたはVault secretが残る場合、rollbackは安全のため失敗する。先に責任者承認を得て対象データとVault secretの扱いを決める。破壊的削除を自動実行しない。
