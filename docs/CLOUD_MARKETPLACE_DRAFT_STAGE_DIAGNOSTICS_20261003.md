# Cloud販売下書きの安全な工程ID診断（2026-10-03）

## Productionで確認した事実

- 対象は`test`本人の非公開E2E専用作品と既存release checkpoint。
- Production反映済みPR #619の画面から、責任者承認範囲内で「販売下書きを作成」を1回だけ実行した。
- Vercel Productionは`POST /creator/{projectId}`を303で処理し、約12秒後に`cloud_marketplace_draft_sync_failed`を1件記録した。
- 例外codeは`INTERNAL_ERROR`だったため、Storage保存系ではなく、完成版artifact生成またはDB同期のどちらかに絞られた。
- 既存loggerは例外名とcodeだけを記録するため、PR #619のログだけでは2工程を安全に区別できなかった。
- 画面再読込後に新しい販売下書きの完了表示はなく、再試行は行っていない。

## 変更

- 販売下書き専用の固定工程IDを追加した。
  - `draft_lookup`
  - `artifact_preflight`
  - `artifact_checkpoint_render`
  - `artifact_pdf`
  - `artifact_generation`
  - `cover_upload`
  - `pdf_upload`
  - `page_upload`
  - `database_sync`
- 既存のDomain Error codeと利用者向け安全文言を維持しつつ、工程IDだけを型付きErrorへ付与する。
- 構造化ログへ`stage`を追加する。未知例外は`unclassified`とし、生メッセージ、stack、Supabase応答、Storage path、画像、Prompt、メール、tokenを記録しない。
- 完成状態確認、checkpoint画像化、PDF生成を分け、次のProduction再試行1回で原因工程を確定できるようにした。

## 変更しないもの

- DB schema、migration、RPC、RLS、Storage object構造
- 公開状態、販売開始、注文、決済、Stripe設定
- Provider実行、生成Job、credit、利用期限
- 既存の補償削除と利用者向けエラー表示

## 検証

- 集中テスト: 17/17
- Hub全テスト: 1250/1250
- Hub typecheck: 成功
- 対象ESLint: 成功
- 依存境界: error 0（既知warning 2）
- Production build: 成功

## 次の工程

1. Draft PRの全CIとVercel Previewを確認する。
2. merge・Production反映後、同じcheckpointの「販売下書きを作成」を1回だけ再試行する。
3. `cloud_marketplace_draft_sync_failed.context.stage`を確認し、原因工程の修正へ進む。
4. 下書き作成が成功しても、公開・販売開始・決済は別承認まで実行しない。
