# Cloud Canvas autosave

## 状態

- `saved`: Server revisionと現在のCanvasが一致
- `dirty`: 未保存の変更あり
- `saving`: 保存request実行中
- `error`: 通信、一時障害、入力エラーまたは応答解析失敗
- `conflict`: Server revisionが先へ進んでいる

`dirty`、`saving`、`error`、`conflict`は未保存状態として扱い、ページ離脱時に警告します。

## 保存と再試行

編集停止から1.2秒後に保存します。requestは10秒でtimeoutし、通信例外、408、425、429、5xx、成功形式ではない一時応答を自動再試行します。間隔は1秒から指数的に増やし、30秒を上限にします。online eventを受信した場合は待機を終了して再保存します。

400／403など永続的な失敗は自動再試行せず、画面の「今すぐ再試行」を使用します。

## 連続編集

各編集でlocal change versionを増やします。保存開始時のversionと完了時のversionが違う場合、先行requestを成功扱いにして終了せず、最新Canvasを次のrequestで保存します。

## 競合

409は自動再試行しません。古い`expectedRevision`で上書きせず、利用者へ「最新状態を再読込」を提示します。再読込によりServerの最新revisionとCanvasを取得します。

## 互換性とSecurity

snapshot APIのPUT body、revision比較、2 MiB上限は変更していません。DB migrationはありません。競合時の自動上書きを禁止することで、別tabや別端末の更新を失わないようにしています。
