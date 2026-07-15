# Desktopクラッシュレポート外部送信設計

更新日: 2026-07-15

## 現在の状態

Desktop側の送信クライアントは実装済みです。ただし、配布物へ同梱する`diagnostics-upload-config.json`の`endpoint`は既定で`null`です。受付APIとプライバシーポリシーが確定するまで、製品版は外部通信せず、外部送信への同意操作も無効になります。

## 利用者操作

1. 「詳細クラッシュレポートを端末内へ保存する」へ同意します。
2. 受付先が設定された製品版だけ、別項目の「外部へ送信する」へ同意できます。
3. 保存先を開けば、送信前に対象JSONを確認・削除できます。
4. 未送信件数を確認して「未送信分を送信」を選び、確認ダイアログで確定します。

自動送信、バックグラウンド送信、ローカル保存同意の流用は行いません。ローカル保存をOFFにすると外部送信同意もOFFになります。

## クライアントの安全条件

- 送信先は署名対象のresources設定から取得し、HTTPSだけを許可
- URL credential、query、fragmentを拒否
- HTTP redirectを拒否
- 1レポート256KB以下、10秒timeout
- 送信直前にformat version 1のschemaで再検証し、秘密値除外を再実行
- SHA-256の`x-mangai-report-id`を冪等キーとして送信
- 成功したファイルだけ端末内ledgerへ記録し、失敗分は再試行可能
- 同時送信を拒否し、同じ端末からの重複送信を防止

送信成功後も端末内ファイルは自動削除しません。利用者が内容を保持・削除できるようにし、「詳細レポートを削除」でファイルと送信ledgerをまとめて削除します。

## 受付API契約

`POST {endpoint}`へ`application/json`で、端末内の`mangai.desktop-crash` version 1を送信します。headerの`x-mangai-report-id`は64文字のSHA-256です。受付側は同じIDを冪等に扱い、初回と重複のどちらも2xxを返す必要があります。レスポンス本文はクライアントが保存しません。

受付側で必須とする対策:

- TLS、request body上限256KB、schema検証
- IP単位とreport ID単位のrate limit
- payloadを認証ログ、proxyログ、error trackingへ重複記録しない設定
- 保存時暗号化、管理者権限分離、アクセス監査
- 保持期間経過後の自動削除
- プライバシーポリシーに送信項目、利用目的、保持期間、問い合わせ・削除方法を明記

## 有効化前の未決事項

- 受付基盤と運用責任者
- 保持期間と削除依頼への対応手順
- 障害通知、rate limit値、監査ログ保持期間
- プライバシーポリシーの公開URL
- stagingでの成功、重複、timeout、5xx、payload上限E2E

これらを確定し、staging合格後にだけリリース用`diagnostics-upload-config.json`へHTTPS endpointを設定します。
