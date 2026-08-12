# PR-R4-1u 漫画画像生成timeout／Scheduler復旧

## 結論

PR-R4-1sのProduction再受入れでは、未生成コマ1つへ登録した2候補がともに1%から進まず、最終的にfailedとなった。各Worker実行は約126〜128秒で終了しており、BFL adapterの既定120秒poll上限と一致する。BFLへのsubmit直後の拒否ではなく、非同期生成の完了待機をアプリ側が先に打ち切った可能性が高い。

本PRはBFL待機、Vercel Worker、GitHub Schedulerの時間上限を内側から210秒、230秒、240秒の順に整合させる。Provider、model、pricing、credit、retry回数、DB、migration、RPC、Storage、Canvas schemaは変更しない。

## 修正

- BFL poll上限を120秒から210秒へ延長する。
- Worker routeの実行上限を180秒から240秒へ延長し、保存、credit確定／解放、補償処理の余白を30秒確保する。
- Schedulerの1リクエスト待機を170秒から230秒へ延長する。
- 最大3件を逐次処理するWorkflow上限を10分から20分へ延長する。
- BFL timeoutをPrompt、画像、URL、Job ID、Provider response本文なしの`stage`／`outcome`だけで診断可能にする。
- Workerの正規終端`failed`をSchedulerの既知状態として扱い、後続Jobへ進む。`retrying`と`lease_lost`は従来どおり即停止し、tight loopを防ぐ。

## 安全境界

- 一般向けCloud画像だけが対象。成人向け境界とDesktop生成を変更しない。
- Provider ID、model ID、request body、pricing version、credit単価、retry回数、Scheduler頻度を変更しない。
- API URL、DB、migration、RPC、Storage bucket／path、Feature Flag、Canvas schema、PDF／PNGを変更しない。
- Prompt、画像、API key、Provider response本文、利用者情報、Job IDをログへ追加しない。

## 検証

- BFL／Worker／Scheduler／duration集中: 27/27
- Hub: 645/645
- Canvas: 26/26
- AI: 48/48
- Supabase migration: 52/52
- deps、lint、Hub／Desktop typecheck: 成功
- Desktop production build: 成功
- Hub production build: 同一実装commitを短い物理worktreeで成功
- RC preflight: repository structure ready。ローカル外部設定は未投入のため従来どおりpending
- git diff check: 成功

長いworkspaceでのHub buildはNext.js TurbopackのWindows path length上限で停止した。同一commitの`C:\CodexTemp\mangai-r4-1u`では成功したため、コード起因ではない。

## マージ後のProduction受入れ

1. 一般向けモニター`test`の既存Creator作品を使用する。
2. 未生成コマ1つだけで2候補を登録する。
3. Schedulerを実行し、2候補がcompletedになることを確認する。
4. 単一コマ全面描画、複数コマ風構成なし、疑似文字なしを目視確認する。
5. 1候補を採用し、自動保存、再読込後の画像・AI背景layer復元を確認する。
6. reserved creditが0へ戻り、成功時だけ使用creditと実費が確定することを確認する。

上記が合格するまで「漫画画像生成は復旧済み」と扱わない。PRマージ前には、旧120秒上限のProductionへ追加の有料Jobを登録しない。

## ロールバック

実装commitをrevertすると従来の120秒BFL待機、180秒Worker、170秒Scheduler待機へ戻る。DB、migration、RPC、Storage dataの巻き戻しは不要。

## 停止条件

Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で責任者判断待ちとして停止する。マージ後のProduction 1コマ2候補受入れに合格してから、8ページ完成漫画と長編credit成立条件へ進む。
