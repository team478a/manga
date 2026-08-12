# PR-R4-1x 長編漫画credit・段階生成成立条件監査

- 状態: `IN_PROGRESS`
- Draft PR: [#242](https://github.com/team478a/manga/pull/242)
- Vercel Preview: https://mangai-hub-staging-git-codex-audit-r4-5dcaff-team478as-projects.vercel.app
- Branch: `codex/audit-r4-1x-longform-credit-plan`
- Base: `origin/feature/manga-canvas-mvp` @ `96f27b6`（PR #241 merge commit）
- 監査日: 2026-08-13
- 範囲: 文書監査だけ。application code、DB、migration、RPC、Storage、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG、成人向け境界、Desktopを変更しない。

## 1. 結論

単一コマのFLUX生成、2候補比較、採用、自動保存、再読込はPR-R4-1wのProduction受入れで成立した。一方、現行の「4〜8ページをまとめて生成」は販売可能な長編漫画を安全に作り切る契約としては未成立である。

主な阻害要因は次の3点。

1. 一括生成は対象コマを同期的に1件ずつQueueへ登録し、各Jobで作品単位rate limitを消費する。Freeは3件/分、Trialは6件/分、Creatorは20件/分のため、それを超える対象は登録途中で終了し得る。
2. 開始前に、対象コマ数、必要credit、最大予約費用、残容量、Scheduler処理回数を合算して表示・拒否するpreflightがない。
3. 途中終了時は`queued > 0`なら部分登録を返すが、画面は登録件数だけを成功表示し、要求件数との差を警告しない。履歴の総数も要求コマ数ではなく紐付いたJob数である。

したがって、Productionで4〜8ページの有料一括生成を追加実行せず、先に合算preflightと部分登録防止を実装・受入れする。

## 2. 現行契約と依存関係

| 責務 | 現在の場所 | 現在の挙動 |
|---|---|---|
| 4〜8ページ／最大64コマ | `src/modules/manga/domain/generation-batch.ts` | page ID重複除去、現revisionの全panelを対象化、0件と64件超を拒否 |
| 一括生成application | `src/modules/cloud-creator/generation/batch-production-service.ts` | batch作成後に`for...of`で1コマずつ登録。`candidateCount: 1`、`generationTarget: "composite"` |
| Queue／quota | `src/modules/cloud-creator/generation/generation-service.ts`、`enqueue_cloud_generation_job_with_quota` RPC | Jobごとにrate limit、plan credit、plan cost、global daily costを確認して予約 |
| 作品別budget | `202608010010_cloud_project_resource_budgets.sql` | Job insert時に作品別credit／cost／storage／kill switchをfail-closedで確認 |
| Server Action | `src/app/creator/actions.ts` | 成功時は`${queued}コマの一括生成を開始しました`だけを表示 |
| 長編画面 | `src/app/creator/[projectId]/LongformPageManager.tsx` | 4〜8ページ、最大64コマを案内。費用、残credit、要求数と登録数の差は非表示 |
| 単一コマ候補 | `CloudCanvasEditor.tsx` | 2／3／4案。初期値は3案。修正、Inpainting、Outpaintingも同じ候補数を使用 |
| Worker | `.github/workflows/cloud-ai-worker-scheduler.yml` | 5分ごと、1回最大3 jobs。手動実行も可能 |

既存のQueue、課金予約、失敗／取消時の予約解放は再利用すべきであり、rate limitやbudgetを単純に迂回してはならない。

## 3. 現在のplan・model・費用

### plan上限

| Plan | 月間credit | 月間費用上限 | user req/min | project req/min |
|---|---:|---:|---:|---:|
| Free | 20 | $2 | 5 | 3 |
| Trial | 100 | $10 | 10 | 6 |
| Creator | 1,000 | $100 | 30 | 20 |

作品別budget、全体の日次費用上限、全体／作品別generation kill switchは、上表より低い実効上限になり得る。

### 現行BFL価格

| Model | credit/job | 最大予約費用/job |
|---|---:|---:|
| `flux-2-klein-9b` | 1 | $0.015 |
| `flux-2-pro` | 2 | $0.030 |
| `flux-2-max` | 4 | $0.070 |
| `flux-pro-1.0-fill` | 3 | $0.050 |

最大予約費用は安全上の予約上限であり、実Provider請求額と同義ではない。PR-R4-1wのProduction実測は`flux-2-pro`の2候補で4 creditを予約・確定した。

## 4. 候補数とcredit成立性

`flux-2-pro`では1コマあたり、2案=4 credit、初期値3案=6 credit、4案=8 creditである。Fill系は最低2案でも6 creditになる。

157コマの既存32ページ作品について、全コマを同じ候補数で生成した場合は次のとおり。

| Model | 1候補/コマ | 2候補/コマ | 3候補/コマ |
|---|---:|---:|---:|
| Klein | 157 | 314 | 471 |
| Pro | 314 | 628 | 942 |
| Max | 628 | 1,256 | 1,884 |

Proで各planが生成できるコマ数は、Freeが1候補10／2候補5／3候補3、Trialが50／25／16、Creatorが500／250／166である。Creatorでも全157コマを初期値3案で生成すると942 creditを使い、残58 creditでは最低2案のFill修正を9コマまでしか実施できない。

Proの最大予約費用は、157 jobsで$4.71、314 jobsで$9.42、471 jobsで$14.13。これはactual costではなく予約時の上限であり、plan、作品別、global dailyの各費用上限に対して評価する。

PR-R4-1w終了時のProduction test accountは残8 creditであり、Proの1候補なら4コマ、2候補比較なら2コマ、初期値3候補なら1コマまでである。現状の残量で長編受入れを開始しない。

## 5. 現行一括生成の不成立条件

- 一括生成は1コマ1候補であり、候補比較を含む販売品質工程ではない。
- 4ページに各1コマ以上ある通常の最小batchでも4 jobsとなる。Freeの作品単位3 req/minを超えるため、現行の同期登録は4件目でrate limitになり得る。
- Trialは7件目、Creatorは21件目以降が同じ1分窓で拒否され得る。64コマまで選べるUI契約と一致しない。
- 先頭Jobが拒否された場合は空batchを取消してerrorを返す。1件以上登録後の拒否はloopを中断し、部分batchを成功値として返す。
- `requested`はserviceのreturn値にあるが、Server Actionと画面は`queued`しか表示しない。
- batch履歴の`totalJobs`は紐付いたJob数であり、当初要求したコマ数を示さない。
- 既存テストは4〜8ページ、64コマ、Queue再利用、先頭失敗時の取消を確認するが、合算quota、rate-limit越境、要求数と登録数の一致、部分登録の表示を確認しない。

## 6. Scheduler容量

定期Schedulerは5分ごと、1回最大3 jobsである。Job数`N`に必要な最小実行回数は`ceil(N / 3)`。157 jobsの初回生成は少なくとも53回のWorker batchとなり、定期起動だけなら約4時間25分の下限目安になる。Provider処理時間、失敗、再試行、GitHub Actions待ち時間で長くなるため、これはSLAではない。

## 7. 推奨する段階生成

販売可能な長編では、全コマへ最初から3候補を生成せず、対象を絞る。

1. 第1段階: 全`P`コマへPro 1候補を生成し、構図と連続性を確認する。必要creditは`2P`。
2. 第2段階: 比較が必要な`C`コマだけ、現行UIの最低2候補を追加する。必要creditは`4C`。
3. 第3段階: Inpainting／Outpaintingが必要な`F`コマだけ、Fillの最低2候補を生成する。必要creditは`6F`。
4. 第4段階: 全ページの採用、再読込、連続性review、checkpoint、完成原稿preflightを通してからPDF／PNG／販売artifactへ進む。

計画式は`2P + 4C + 6F` credit。157コマの第1段階は314 creditであり、残りを選択的比較と修正に確保できる。

## 8. 推奨PR分割

### PR-R4-1y 合算preflightと表示

- 対象ページ／コマ数、model、pricing version、候補数、必要credit、最大予約費用、残容量、Scheduler最小batch数を開始前に表示する。
- plan、作品別budget、全体日次budget／kill switchのうち取得可能な実効容量をfail-closedで評価する。
- 容量不足時はbatch作成前に拒否する。
- 要求コマ数、登録コマ数、未登録コマ数を結果と履歴に表示する。
- 見込み: application／presentation／tests中心、約6〜10 files、250〜500行。既存のread契約で不足する場合はDB変更を混在させず再分割する。
- 回帰: 4／8ページ、64コマ境界、候補1固定、credit／cost計算、容量不足、kill switch、表示、秘密値非表示。

### PR-R4-1z rate limitを越えるdurable登録

- 全対象を一括で安全に予約するか、永続targetを作りdispatcherがrate limit内で徐々にJob化する。
- silent partial successを禁止し、要求数と最終登録数を一致させる。取消時は未処理targetと予約を解放する。
- rate limitの単純な無効化／迂回は禁止する。
- DB／migration／RPCを伴う可能性が高いため、方式とrollbackを責任者承認後に別PRで実装する。
- 見込み: migration／repository／application／tests、約6〜12 files、350〜700行。
- 回帰: 同時実行、冪等性、rate limit窓、途中失敗、再開、取消、予約解放、既存単一Job契約、migration roundtrip。

### PR-R4-1aa 4ページ限定Production受入れ

- R4-1y／1z merge後、十分なcreditを持つtest monitorで4ページ・1候補/コマだけを実行する。
- 要求数=登録数、Scheduler完了、credit予約／確定、失敗時解放、採用、保存、再読込、checkpointを確認する。
- 実装は原則不要。証跡と台帳で約4 files、100〜200行。

### PR-R4-1ab 8ページ完成原稿・販売品質受入れ

- 4ページ合格後だけ8ページへ拡大し、選択的比較／修正、人物連続性、全ページ確定、PDF／PNG、販売artifact preflightを確認する。
- 公開・実決済は別承認とする。証跡中心、問題検出時は修正PRを分離する。

## 9. 回帰テスト方針

- Domain: page重複除去、4〜8ページ、0コマ、64コマ、65コマ。
- 計算: 各model／candidate数、Fill、credit、最大予約費用、overflow、丸めなし。
- Capacity: plan、作品別budget、global daily budget、各kill switch、reserved + used。
- Queue: 全targetの冪等登録、rate limit越境、途中失敗、再開、取消、予約解放、requested=queued。
- UI: 開始前見積り、容量不足、部分状態、残量、秘密値・prompt・画像を表示／logしない。
- Worker: 1回3 jobs、複数回継続、失敗Job後続、再実行。
- E2E: 4ページから開始し、比較、採用、自動保存、再読込、checkpoint、preflightまで確認する。

## 10. rollback

- R4-1y: presentation／application変更をrevertし、既存の単一コマ生成を維持する。既存外部契約は変更しない。
- R4-1z: forward-only rollback migrationで新dispatcherを停止し、未処理targetを取消・予約解放する。既存migration履歴を編集・削除しない。
- Production受入れ: batch取消とJobの既存予約解放を確認する。利用者が採用・保存した正規データを無断削除しない。

## 11. 実Provider受入れ前の停止条件

- exactな対象ページ数／コマ数が画面に表示される。
- plan、作品別、globalのcredit・最大予約費用容量を開始前に確認できる。
- rate limitを越えても全targetがdurableに登録され、silent partial successがない。
- 要求数、登録数、未登録数、残creditが表示される。
- 途中失敗、取消、retryで予約が二重計上されず、不要な予約が解放される。
- Schedulerの処理容量と時間目安を運用側が了承する。
- test monitorへ試験範囲分だけcreditを用意する。
- 最初は4ページ・1候補/コマに限定し、8ページや32ページ全体を先に実行しない。

## 12. PR-R4の次工程へ進む条件

R4-1y／1zの方式、外部契約、migration要否を責任者が承認し、両PRの全CIとVercel Previewが成功し、4ページProduction受入れが合格するまで8ページ完成原稿受入れへ進まない。Provider、model、pricing、rate limit、Scheduler頻度を本監査の判断だけで変更しない。

## 13. ローカル検証

- 集中テスト: 20/20成功（batch、longform application境界、Cloud AI error、作品別resource budget）。
- `npm run deps:check`: 成功（既存warning 2件、新規error／warning 0件）。
- `npm run rc:preflight`: repository structure READY。外部秘密情報をローカルへ置かないため外部設定はPENDING、manual E2Eは別管理。
- `git diff --check`: 成功。
