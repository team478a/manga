# P0〜P4 closeout audit

## 結論

P0〜P4のrepository scopeは完了している。7条件のうち5件はrepository gate成功、人物連続性はP3-Eの有償BFL 10シーン比較で受入れ成功、残る1件はrepository成功だがstaging durable export受入れ待ちである。この外部gateが完了するまで、初期ユーザー提供READYとは判定しない。

## 完了条件matrix

|完了条件|判定|正本証跡|
|---|---|---|
|20ページを中断・再開|REPOSITORY_PASSED|`cloud-generation-run-checkpoint.test.mjs`|
|失敗コマだけ再試行|REPOSITORY_PASSED|`cloud-quality-inspection-acceptance.test.mjs`|
|主要人物の重大な別人化20%以下|PROVIDER_ACCEPTANCE_PASSED|P3-E有償BFL参照付き10シーンで重大な別人化防止10/10（受入8/10以上）|
|セリフ修正で画像再生成なし|REPOSITORY_PASSED|`cloud-panel-editing-ten-panel-acceptance.test.mjs`|
|設定・モデル・参照画像・履歴の追跡|REPOSITORY_PASSED|`cloud-story-bible-ten-scene-acceptance.test.mjs`|
|1ページ単位のPDF／画像出力|REPOSITORY_PASSED_EXTERNAL_PENDING|P4-F固定3作品成功。staging migration／Storage／Workerは未受入れ|
|作品別費用と再生成回数|REPOSITORY_PASSED|`cloud-quality-inspection-acceptance.test.mjs`|

## 次優先ゴール

責任者の明示承認後、次の順で実環境証跡を取得する。

1. stagingへ未適用migrationを順番に適用し、Feature Flag既定OFFを維持したままschema／rollbackを確認する。
2. stagingで専用Flagを一時的に有効化し、固定一般向けProject 1件だけでdurable PNG ZIP／Project JSONの中断再開、owner境界、署名URL、Storage cleanupを検証する。
3. staging export成功後、初期ユーザー提供可否を再判定する。
4. BFL原価guardのProduction受入れは別途、`PRODUCTION_BFL_COST_ACCEPTANCE_RUNBOOK_20260826.md`に従い、PCで対象Supabaseへアクセスできる場合だけ最大予約`$0.180`の1 Jobを実施する。これは人物連続性条件の再試験ではない。

## 今回行わないこと

- Production／staging変更、migration適用、Feature Flag変更。
- Provider／Worker／Job／Storage実行、credit予約・消費。
- P3-E証跡を超えて実画像品質を一般化すること。
