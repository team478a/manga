# PR-R4-2D 作品管理・販売準備と完成原稿の連携

- Draft PR: [#261](https://github.com/team478a/manga/pull/261)

## 結論

Cloud漫画の販売原稿を制作中Canvasから切り離し、`kind='release'`の完成版checkpointへ固定する。`works.image_url`は表紙・サムネイルとして維持し、本文はversion付きpublicationとprivate Storage上のページPNG／PDFを正本とする。

## 既存契約の確認

- 作品とCloud制作Projectの正式な関連は`works.source_project_id`。
- 完成原稿の固定点は`cloud_project_checkpoints.kind='release'`と`cloud_project_checkpoint_pages`。
- release checkpoint作成前に全ページ完成、原稿preflight、ページ確定をServerで検証する。
- 既存商品PDFは`digital_products.file_url`、購入権限は`orders.buyer_profile_id`かつ`status='paid'`。
- 旧1枚画像作品は`source_project_id is null`であり、新しいpublication列をnullのまま維持する。

## 実装

- `cloud_work_publications`へwork／project／release checkpoint／version／page count／PDF／manifest hashを固定する。
- `cloud_work_publication_pages`へページ順、寸法、private PNG path、sample境界を固定する。
- `works.current_publication_id`、`published_version`、`published_at`をnull許容で追加する。
- 販売同期は明示選択したrelease checkpointのCanvas blobとAsset hashを照合し、PNG／PDFを新規pathへ保存する。旧versionの成果物は削除しない。
- 作品公開と商品販売開始は、Cloud漫画だけDB triggerとServer Actionの両方で完成版固定を必須にする。
- 公開・販売中のversion切替を拒否する。停止後は過去versionを明示選択してrollbackできる。
- `/works/[id]/read`は縦長原稿を`object-contain`で1ページ表示し、前後移動、ページ番号、総ページ数を提供する。owner／購入者は全ページ、未購入者はsampleだけを5分の署名URLで閲覧する。
- 作品編集画面では表紙、制作Project、完成版version、本文ページ数、本文確認、version切替を区別して表示する。

## 外部契約

- 既存URL、旧作品、Stripe checkout、購入PDF download、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、成人向け境界、Desktopを変更しない。
- migrationは追加のみ。Productionへは適用していない。
- 既存`sync_cloud_marketplace_draft`は残し、新しいcheckpoint固定RPCを別名で追加する。

## 受入れ

- release checkpoint以外、manifest不一致、page count不一致、owner不一致を拒否する。
- 未完成Cloud作品は公開・販売開始できない。
- 公開中の制作Canvas変更は固定済みpublicationのPNG／PDFへ反映されない。
- 旧versionは停止後に明示選択できる。
- 読者権限はowner／paid order／sampleに分離する。
- Production DB、既存Production作品、実Providerを変更しない。

## 検証結果

- 集中回帰 7/7、Hub 708/708、Canvas 26/26、AI 48/48、Desktop 182/182成功。
- dependency check、lint、Hub／Desktop typecheck、migration manifest 59/59、PostgreSQL 16で全forward→rollback→forward、Webpack Hub build、Desktop build、RC structure preflight、`git diff --check`成功。
- 通常Turbopack buildはWindowsの長い作業パス上限で停止し、同じsourceをWebpackでproduction buildした。
- Desktop a11yはローカルElectron起動がtimeoutしたため、GitHub Windows CIの結果を正式な受入れ結果とする。

## Rollback

1. アプリをPR-R4-2D前のcommitへ戻す。
2. 公開中Cloud漫画がないことを確認する。
3. `supabase/rollbacks/202608140004_cloud_work_publications.sql`を適用する。
4. publication用Storage成果物はDB rollback後にowner/project/version prefixを照合して別工程で清掃する。既存商品PDFは削除しない。

## 未実施・停止条件

- Production migration、Production公開、実決済、課金Provider呼出しは行わない。
- Draft PRの全CIとVercel Preview確認後、責任者review待ちで停止する。
