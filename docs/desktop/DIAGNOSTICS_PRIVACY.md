# Desktop診断ログとプライバシー

## 保存内容

MANGAI Desktopは`{Documents}/MANGAI/logs/desktop.jsonl`へ、起動、終了、IPC失敗、バックアップ失敗、DB復旧、renderer・child process異常などの構造化イベントを保存します。ログは端末内だけで利用し、外部送信機能はありません。

JSONLログは5MBごとにローテーションし、現行ファイルと過去3世代を保持します。

## 詳細クラッシュレポート

設定画面の「診断データとプライバシー」で利用者が明示的に同意した場合だけ、次を含む`crash-*.json`を端末内へ保存します。

- 発生日時と発生元
- MANGAI Desktop、Electron、OS、CPU architectureのバージョン情報
- エラー名、メッセージ、stack
- process終了理由、exit codeなどの限定された診断情報

最大20件を保持します。設定画面から保存先を開き、詳細レポートを全削除できます。同意はいつでもOFFへ戻せます。OFFへ戻しても既存ファイルは自動削除しないため、不要な場合は「詳細レポートを削除」を実行します。

## 除外処理

ログと詳細レポートは保存前に再帰的に正規化し、次を除外・短縮します。

- `authorization`、`cookie`、`password`、`secret`、`token`、API key、device codeに該当するfield
- Bearer token、OpenAI形式のsecret key、JWT
- URL queryのtoken、key、secret、code
- OSのhome directory部分
- 過大な文字列、配列、object、深い階層

Project本文、Creator Chat本文、AI prompt、素材画像は診断イベントへ意図的に渡しません。

## 捕捉対象

- Electron main processの`uncaughtException`と`unhandledRejection`
- renderer processの異常終了と応答停止
- Electron child processの異常終了
- IPC handlerの失敗種別
- 自動バックアップ失敗件数、DB復旧件数

`uncaughtException`は同期保存後にアプリを異常終了させ、壊れた状態で処理を継続しません。

## 外部送信

外部送信クライアントは実装済みですが、現行の配布設定では受付先が未設定のため外部通信は発生しません。受付先が設定された版でも、ローカル保存とは別の明示同意と、未送信件数を確認した後の手動送信が必要です。自動送信は行いません。

送信先はHTTPSだけを許可し、redirectを追跡しません。送信直前にschema検証と除外処理を再実行し、成功したレポートだけを送信済みとして端末内へ記録します。失敗分は未送信のまま残り、手動で再試行できます。詳細は[`DIAGNOSTICS_UPLOAD_DESIGN.md`](DIAGNOSTICS_UPLOAD_DESIGN.md)を参照してください。
