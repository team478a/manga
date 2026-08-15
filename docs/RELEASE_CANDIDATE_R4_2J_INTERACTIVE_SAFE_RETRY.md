# PR-R4-2J Provider拒否後の対話型コマ安全再実行

## 目的

参照画像を使った単一コマ再制作はProviderへ正常に登録され、保存済みProvider Job IDからpollを継続できた。一方、Provider完了時の拒否後にページ編集画面から再実行すると、失敗Jobの入力を参照せず同じパネルから元の生成条件を作り直すため、同じ拒否を繰り返していた。

このPRは、失敗した対話型コマJobを本人の保存済み入力から安全に復元し、Provider投入後に拒否された一般向け画像だけを穏やかな間接表現へ一度だけ再構成できるようにする。

## Production切り分け証跡

- 対象は一般向けモニター`test`の既存作品、ページ22の不良候補1件。
- 作品内の品質確認済みAssetを、作品全体の画風参照へ1件だけ登録した。Assetの再アップロードや複製はない。
- 最初の再制作は1候補のみ登録した。公式WorkerはProvider Job IDを保存し、約210秒の区切り後も同じJobをpollしたため重複POSTはない。継続pollで終端失敗した。
- 画面の`このコマだけ再実行`を1回だけ実行した。新しいJobは同じ元Promptを再構築し、同様に終端失敗した。
- 両方とも予約2 creditは全額解放され、最終は使用38、予約0、残り62。候補配置、品質承認、Canvas、公開・販売状態は変更していない。
- 追加のProvider Job、Worker run、有料生成は停止した。
- Prompt、Provider応答本文、画像、Provider Job ID、API key、利用者情報はログ・文書へ記録していない。

## 根因

長編一括生成には失敗Job IDを受け取る専用処理がある。一方、ページ編集画面の失敗カードは`requestStoryboardPanelGeneration`を呼び、失敗Jobの`error_code`、保存済み`input`、参照Asset、Provider投入状態を参照していなかった。

旧Draft PR #254には長編batch向けの一般化安全処理があるが、未マージであり、最新`feature/manga-canvas-mvp`にも対話型経路にも含まれていない。本PRはPR #254を変更せず、最新基準から必要な契約だけを独立実装する。

## 実装

1. `POST /api/creator/generation-jobs/[jobId]/retry`を追加する。
2. 既存認証とRLSで本人が編集可能な失敗Jobだけを取得し、`cloudGenerationInputSchema`で保存済み入力を再検証する。
3. 画像、対象コマ、page IDが揃う対話型Jobだけを許可する。
4. Provider Job ID保存後の`provider_rejected`／`provider_moderation_blocked`だけ、動作・感情・演出・追加指定を一般向けの間接表現へ差し替える。
5. 人物外見、固定ビジュアル設定、画風、世界観、参照Asset ID、画像寸法、対象コマ、source page revision、generation operationを保持する。
6. 元JobのPanel Specificationを新Jobへbest-effortで引き継ぎ、既存品質判定と自動配置契約を維持する。
7. 一般向け安全化済み入力が再度拒否された場合は同一入力を再登録せず、構図または内容の変更を案内する。
8. BFLの`Request Moderated`／`Content Moderated`を即時の非retry `provider_moderation_blocked`へ分類する。
9. 長編batchの失敗Jobも同じ純粋Domain policyを使用する。

## 不変条件

- Provider、model、pricing、credit単価、retry回数、210秒timeout、30分上限、Schedulerを変更しない。
- DB、migration、RPC、Storage、Feature Flag、Canvas schema、checkpoint、PNG／PDFを変更しない。
- 一般向けCloudだけを対象とし、成人向け判定と外部送信のfail-closed境界を緩和しない。
- Desktopを変更しない。
- Prompt、画像、Provider応答本文、Provider Job ID、秘密値を通常ログへ追加しない。

## 回帰検証

- 集中27/27: Domain安全化、二重変換防止、BFL moderation status、対話型route／service／UI、batch配線。
- Hub全体、Canvas 26/26、AI 48/48、100ページ長編4/4。
- `deps:check`、lint、Hub typecheck、migration 59/59、research eval。
- Cloud漫画repository受入れ、owner isolation。
- workspace packages build、Webpack production build、RC structure、`git diff --check`。
- 通常Turbopack buildは既知のWindows path長上限で停止した。Desktop test／a11yは既存`@napi-rs/keyring`型宣言不足で停止したため、GitHub Windows CIを正式結果とする。

## ロールバック

このPRのcommitをrevertする。DB rollback、Storage操作、Provider設定変更は不要。既存失敗Job、Asset、Canvas、credit状態は変更されない。

## merge後の限定受入れ

1. Production反映を確認する。
2. ページ22に保存済みの対象失敗Jobから、`このコマだけ再実行`を1回だけ実行する。
3. 新Jobが1件、予約2 creditであることを確認する。
4. 公式Workerで同一Provider Job pollを継続し、重複POSTがないことを確認する。
5. 完了時はAssetと候補を目視し、人物同一性、単一場面、文字混入、人体、小物接触を評価する。失敗時はcredit全額解放と固定エラー案内を確認する。
6. 結果にかかわらず追加の有料再実行を止め、次の品質判断を責任者へ報告する。
