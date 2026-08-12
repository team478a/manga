# PR-R4-1t 販売下書き完成原稿preflight

- Draft PR: [#238](https://github.com/team478a/manga/pull/238)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-6729b3-team478as-projects.vercel.app

## 目的

PR-R4-1sのProduction E2Eで、画像1/157、完成0/32、確定0/32、必須修正267の未完成原稿から販売下書きと商品PDFを作成できることを確認した。本PRは、販売準備を既存の完成原稿判定と同じ条件でfail-closedにする。

## 修正

- Creator作品画面は完成原稿preflightが未合格または取得失敗なら販売下書きbuttonを無効化する。
- 未合格理由として要修正件数と全ページ確定条件を表示し、原稿チェックへ戻れるようにする。
- 販売artifact生成入口で`getCloudManuscriptPreflight(projectId, { requireFinalizedPages: true })`を必須実行する。
- 未合格時は`ValidationError`で停止し、表紙・商品PDFの生成、Storage upload、Marketplace RPCより前に終了する。
- 完成条件はdurable PDFと同じ既存判定を再利用する。

## 販売下書きの合格条件

- 表紙ページが設定されている
- ページ番号が連続している
- 全可視コマに参照可能な画像Assetがある
- 文字が枠内に収まっている
- 全ページが確定済みである
- 確定revisionと現在revisionが一致する
- 制作設定変更後の再確認が完了している
- queued／runningの画像生成がない

警告だけの低解像度候補は既存preflightどおり停止条件にしない。公開済み作品と販売中商品の上書き禁止も維持する。

## 安全境界

- DB、migration、RPC署名・権限・処理、Storage bucket／path、API、URL、Feature Flagを変更しない。
- Provider、model、pricing、credit、retry、timeout、Schedulerを変更しない。
- Canvas schema、PDFの内容・形式、成人向け境界、Stripe決済、Desktop codeを変更しない。
- 完成原稿の正常系は、従来どおり非公開作品と販売停止商品を作成・更新する。
- PR-R4-1sで作成した検証用作品・商品を公開、有効化、削除しない。

## 回帰テスト

- 完成preflight成功時だけ販売処理へ進む。
- 267件の要修正を含む未完成原稿は、件数を含む利用者向け`ValidationError`となる。
- preflightの取得失敗は画面上もfail-closedとなる。
- artifact stagingより前に完成判定を強制する。
- 公開済み作品／販売中商品の既存上書き禁止を維持する。

## 検証

- Marketplace／manuscript／durable export集中: 13/13
- Hub: 643/643
- Canvas: 26/26
- AI: 48/48
- Supabase migration: 52/52
- deps、lint、Hub／Desktop typecheck: 成功
- Hub production build: 短い物理worktree `C:\CodexTemp\mangai-r4-1t`で成功
- Desktop production build、RC preflight、diff check: 成功
- 長いclone pathのHub buildはTurbopackのWindows path length上限で停止。同一commitの短い物理worktreeで成功したためコード起因ではない。
- Desktop統合テストは同一Windows環境のElectron終了待ちで2回とも結果出力前に停止した。Desktop codeは変更しておらず、GitHub ActionsのWindows buildで最終判定する。

## ロールバック

実装commitをrevertすると従来の販売下書き動作へ戻る。DB、migration、RPC、Storage dataの巻き戻しは不要。Productionの検証用非公開作品・販売停止商品は本PRで変更しない。

## 停止条件

- Draft PRのCore quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で停止する。
- 責任者確認前に画像Provider失敗修正やScheduler修正を同じPRへ追加しない。
- merge後、Productionの未完成32ページ作品でbutton無効とServer Action拒否を読み取り中心に再確認する。
