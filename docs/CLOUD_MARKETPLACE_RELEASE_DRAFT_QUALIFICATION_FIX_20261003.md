# Cloud販売下書きDB同期の列名衝突修正

日付: 2026-10-03  
対象: Cloud一般向け作品の非公開販売下書き同期

## Production診断結果

- PR #620の工程ID診断をProductionへ反映後、責任者承認済みの`test`非公開2ページ作品で販売下書きを1回だけ再試行した。
- artifact生成、表紙、PDF、ページ画像のStorage保存を通過し、`database_sync`で停止した。
- Production SQL Editorの診断は対象Projectの作品0件、商品0件、publication 0件、checkpoint page 2件を確認した。
- 同じRPCをダミーStorage参照で実行し、例外を捕捉したうえでトランザクション全体を`ROLLBACK`した。結果はSQLSTATE `42702`、`column reference "work_id" is ambiguous`だった。
- 公開、販売開始、注文、決済、Provider、credit、永続DB変更は行っていない。失敗したアプリ処理のStorage uploadは既存の補償削除対象であり、DBはRPC transactionにより部分保存されていない。

## 原因

`sync_cloud_marketplace_release_draft`は`returns table(work_id, product_id, publication_id, publication_version)`を宣言している。一方、関数内の`where work_id=v_work_id`が出力変数`work_id`とtable列`work_id`のどちらを指すか決められず、初回作品作成後のpublication version計算で停止していた。

## 修正

- migration `202610030001_cloud_marketplace_release_draft_qualification`でRPCを置換する。
- `work`、`product`、`publication`、`checkpoint_page`などのtable aliasを付け、DB列を完全修飾する。
- `#variable_conflict error`を明示し、今後未修飾の衝突をfail closedにする。
- SECURITY DEFINER、`search_path=public,pg_temp`、authenticated／service_roleの実行権限、公開済み作品とactive商品の拒否、完成版checkpoint検証、原子的同期は維持する。
- rollbackは変更前のRPC定義へ戻す。

## 検証と次工程

- 集中11/11、Hub 1252/1252、migration静的96/96、Hub型検査、対象lint、Production build、diff check成功。
- 修正版RPCをProductionの一時transaction内へ定義して同じ入力を実行した結果は`completed`だった。続けてfunction定義を含む全変更を`ROLLBACK`し、修正版未残存、作品0件、商品0件、publication 0件を再確認した。
- PR #621 merge後、責任者承認値と原本SHA-256の一致を確認し、Production Project `vmdsyxykcrgxcdbrwlkv`へmigrationを1回適用した。
- postflightで`#variable_conflict error`、publication／productの`work_id`完全修飾、authenticated／service_roleの実行権限、anon実行権限なしを確認した。
- 同じ非公開2ページ作品で販売下書きを1回だけ再試行し成功した。作品は`draft`・非公開、商品は`paused`・500円、publication v1・2ページ、publication pageは2件。
- 注文0件、対象Projectの生成Job 0件、費用台帳0件。公開、販売開始、決済、Provider、credit消費は行っていない。
- 次は商品・作品設定の表示を確認し、一般公開と販売開始を伴うcanaryは別の実行時明示承認で進める。
