# P4-D Hub単体Project JSON・長編durable images

## 結果

- 既存durable PDFの4ページsegment、lease、一時停止、再開、非公開Storage pathを維持した。
- 同じ状態機械へ`images`と`project_json`を追加した。
- `images`はsegmentごとの連番PNGを再利用し、最終segmentでページ順のZIPを作る。
- `project_json`はsegmentごとにページmetadataとCanvas snapshotを保存し、最終segmentでschema version、mode profile、Project、ページ順、export provenanceを統合する。
- download名とUI表示はjob formatから解決する。

## Feature Flag

- `MANGAI_CLOUD_DURABLE_EXPORT_FORMATS_ENABLED`
- strict `true`だけ有効。未設定／falseではUI非表示かつServiceが新形式登録を拒否する。
- 既存PDFはFlagに依存せず従来どおり利用できる。

## Migration

- `cloud_export_jobs.format`へ`images`／`project_json`を追加。
- 非公開`cloud-exports` bucketへ`application/json`を許可。
- rollbackは新形式jobが存在する場合にデータを削除せず停止する。

## 非実施

- migrationのProduction／staging適用、Flag有効化
- 実Worker起動、Storage upload、Job登録
- Provider、生成、credit操作
- JPEG（P4-E）

## 検証

- 集中7/7、Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0
- migration 74件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
