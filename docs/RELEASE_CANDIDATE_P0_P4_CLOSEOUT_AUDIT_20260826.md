# P0〜P4 closeout audit

## 結論

P0〜P4のrepository scopeは完了している。ただし、初期ユーザー提供の全条件を「実環境で完了」とはまだ判定しない。7条件のうち5件はrepository gate成功、1件は実Provider視覚比較の承認待ち、1件はrepository成功だがstaging durable export受入れ待ちである。

## 完了条件matrix

|完了条件|判定|正本証跡|
|---|---|---|
|20ページを中断・再開|REPOSITORY_PASSED|`cloud-generation-run-checkpoint.test.mjs`|
|失敗コマだけ再試行|REPOSITORY_PASSED|`cloud-quality-inspection-acceptance.test.mjs`|
|主要人物の重大な別人化20%以下|EXTERNAL_APPROVAL_REQUIRED|10シーン追跡fixtureは構造追跡済み。実画像6視覚項目は未評価|
|セリフ修正で画像再生成なし|REPOSITORY_PASSED|`cloud-panel-editing-ten-panel-acceptance.test.mjs`|
|設定・モデル・参照画像・履歴の追跡|REPOSITORY_PASSED|`cloud-story-bible-ten-scene-acceptance.test.mjs`|
|1ページ単位のPDF／画像出力|REPOSITORY_PASSED_EXTERNAL_PENDING|P4-F固定3作品成功。staging migration／Storage／Workerは未受入れ|
|作品別費用と再生成回数|REPOSITORY_PASSED|`cloud-quality-inspection-acceptance.test.mjs`|

## 次優先ゴール

責任者の明示承認後、次の順で実環境証跡を取得する。

1. stagingへ未適用migrationを順番に適用し、Feature Flag既定OFFを維持したままschema／rollbackを確認する。
2. stagingで専用Flagを一時的に有効化し、固定一般向けProject 1件だけでdurable PNG ZIP／Project JSONの中断再開、owner境界、署名URL、Storage cleanupを検証する。
3. 費用上限と対象10シーンを明示承認後、参照付き現行方式の実画像を生成し、顔・髪・衣装・体格・配色・構図追従を採点する。
4. 重大な別人化20%以下とstaging export成功が揃った時点で、初期ユーザー提供可否を再判定する。

## 今回行わないこと

- Production／staging変更、migration適用、Feature Flag変更。
- Provider／Worker／Job／Storage実行、credit予約・消費。
- 未評価の実画像品質をPASSとして記録すること。
