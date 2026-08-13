# PR-R4-1y 長編一括生成 合算preflight

- 状態: `IN_PROGRESS`
- Branch: `codex/fix-r4-1y-longform-batch-preflight`
- Base: `origin/feature/manga-canvas-mvp` @ `cbb0d74`（PR #242 merge commit）
- 実施日: 2026-08-13

## 目的

4〜8ページ一括生成を開始する前に、選択ページの現在revisionから対象コマ数と必要利用枠を合算し、容量不足や現行同期登録の限界を利用者へ明示してfail-closedで停止する。

## 実装

- 現在snapshotをページごとに検証し、選択ページ数、対象コマ数、空ページ、snapshot欠損、64コマ上限を評価する。
- 現在有効なBFL model／pricing version／1 Jobあたりcredit／最大予約費用を既存設定と料金テーブルから取得する。
- plan、作品別budget、global daily budget、各generation switch、モニターAI残回数を合算評価する。
- 1コマ1候補、必要credit、最大予約費用、plan残credit、作品残credit、モニター残回数、Scheduler最小回数／時間、1分登録上限を開始前に表示する。
- 容量不足、設定取得失敗、空ページ、現在snapshot欠損、1分登録上限超過はbatch作成前に拒否する。
- 一括生成Server Actionは全件登録時だけ成功表示する。途中登録時は要求コマ数、登録済みコマ数、未登録コマ数を赤い警告で表示する。
- 履歴の`totalJobs`は従来どおり紐付いたJob数なので、表示を「登録済み」に改め、選択ページ数と区別する。

## 安全境界

- Queue、Job、課金予約、失敗／取消時の解放、Provider選択、model、pricing、retry、timeout、Scheduler頻度を変更しない。
- DB、migration、RPC、Storage、API、URL、Feature Flag、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。
- API key、Vault secret ID、Prompt、画像、利用者情報をclient props、画面、logへ渡さない。
- 最大予約費用を実請求額と表現しない。
- global daily容量はserverで評価する。clientへ渡すのは数値化済みの残容量だけで、秘密情報は含まない。

## 現行rate limitとの関係

Freeは3、Trialは6、Creatorは20 jobs/分が作品単位上限である。R4-1yでは対象コマ数が現在の1分登録上限を超えるbatchを開始前に止める。これにより、Freeの通常の4ページbatchは安全なdurable登録が入るまで実行不可になる。

同一rate windowで既に使われた件数を含め、全targetを永続化して徐々にJob化する処理はR4-1zの範囲である。R4-1yはrate limitを迂回・緩和しない。

## 回帰テスト

- 4〜8ページ、現在snapshot、空ページ、64コマ境界。
- credit／最大予約費用／Scheduler回数の合算。
- plan、作品、global、monitor不足。
- user／project rate limitの小さい方を登録上限として使用。
- 全件登録時の成功表示と部分登録時の要求／登録／未登録警告。
- 既存batch progress、pause、resume、cancel、retry。

## rollback

本PRのapplication／presentation差分をrevertすれば、既存の一括生成と単一コマ生成へ戻せる。DBや永続形式を変更していないためdata migrationは不要。すでに登録・採用・保存された利用者データは削除しない。

## ローカル検証

- 集中17/17、Hub 650/650、Canvas 26/26、AI 48/48成功。
- deps、lint、Hub／Desktop typecheck、migration 52/52、Desktop build、RC repository structure、diff check成功。
- Hub production buildは元worktreeではWindows長path上限で停止し、同一commitの短い物理worktreeで成功した。
- Desktop統合testはElectron終了待ちで結果出力前にローカルtimeout。Desktop差分はなく、Windows CIを最終判定にする。

## 次工程

Draft PRの全CIとVercel Preview成功後に停止する。責任者確認前にR4-1zのDB／migration／RPC設計や、4ページ有料Production受入れへ進まない。
