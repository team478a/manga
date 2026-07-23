# Backup / Restore / Cloud Export streaming

## 上限

- Backup archive: 2 GiB
- manifest: 50 MiB
- ZIP entries: 20,000
- 展開後合計: 2 GiB
- 異常圧縮率: 1 MiBを超えるentryで200倍超を拒否
- Cloud Asset: 20 MiB
- Cloud Project Asset合計: 2 GiB
- Cloud同時取得: 3（実装上2〜4へ制限）

## Desktop Backup

Assetは事前にファイルストリームでSHA-256とbyte数を確認します。`yazl`へ実ファイルpathを渡してZIPを一時ファイルへstream生成し、完了後に出力先へrenameします。中断時は`.partial`を削除します。

## Desktop Restore

`yauzl`をlazy entry modeで開き、central directoryのentry数、各entryの展開サイズ、合計サイズ、圧縮率、path traversal、重複名を検査します。manifestだけを上限付きでメモリへ読み、Assetは一時ディレクトリへ1件ずつ展開してSHA-256を確認します。

全Assetの検証後に新しいIDへfile名を割り当て、一時Projectディレクトリを正式な保存先へrenameします。その後のSQLite transactionが失敗した場合もProject行と保存先を削除するため、半端なProjectを残しません。

## Cloud Export

Supabase Storageからの取得は3 workerに制限します。Assetは一時ディスクへ保存し、Pageごとに参照中のAssetだけを読み込んでPNGを描画します。画像ZIPと販売パッケージZIPは一時ファイルへstream生成し、API responseもfile streamで返します。responseのclose時に一時ディレクトリを削除します。

PDF生成は`pdf-lib`の最終文書組み立て時に出力相当のメモリを使用しますが、元Projectの全Assetを同時保持しません。将来PDF自体が大容量化する場合は、incremental PDF writerへの置換を別タスクで検討します。
