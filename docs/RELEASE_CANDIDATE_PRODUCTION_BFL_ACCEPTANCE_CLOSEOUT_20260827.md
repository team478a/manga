# Production migration・BFL原価guard受入れcloseout

作成日: 2026-08-27  
Branch: `codex/production-bfl-acceptance-closeout`  
Base: `92972810bd8091eb16ed3417ed10a6b562897b21`（PR #372 merge commit）

## 結論

対象Supabase Production project `vmdsyxykcrgxcdbrwlkv`で、未適用migration 13本を正本順に適用し、Creator画面のschema不足による読込失敗が解消した。続けて、責任者承認済みのBFL `flux-2-pro`参照付き1 Jobだけを実行し、`bfl-flux2-pro-2026-08`の予約上限、Provider実額反映、差額解放、Asset保存、重複防止を受け入れた。

追加Job、自動retry、Provider再送、Production修復、秘密値変更は行っていない。初期ユーザー提供READYの残り外部gateは、staging durable export実Storage／Worker受入れ1件である。

## Production migration

- 適用前のDBには`202608180002_cloud_monitor_quality_review_panel.sql`までの到達証跡があり、`202608240001_cloud_generation_two_page_pilot.sql`以降は未適用だった。
- `202608240001`から`202608260002`までの連続した13本だけをmanifest順に適用した。
- 生成Job event／checkpoint、character reference readiness、character state、panel continuity、panel design、manga inspection、completion mode、durable export形式の主要table／column／constraintを確認した。
- 2ページまたは4〜8ページのbatch constraint、PDF／images／Project JSONのexport constraintを確認した。
- `bfl-flux2-pro-2026-08`はbackground／prop／effect／character_baseの4行がactiveで、各`max_cost_micros=180000`だった。
- 適用後、Production `/creator`は正常に作品一覧を表示し、対象作品／ページ編集画面まで読込できた。

## BFL参照付き1 Job受入れ

- 対象は一般向け固定作品「灰の証言者 第1話『燃え跡の罠』｜32P・8P並列制作連続性設計」。
- 旧参照Assetは人物ではなく、品質確認済み原稿画像を使う作品全体のstyle参照だった。人物reference bindingへ誤変換せず、過去Jobで同じstyle参照が入力へ含まれた証跡のあるページを使った。
- 実行直前のactive queueは0件、予約creditは0、利用可能creditは20だった。
- 新規生成UIは候補数が2〜4案のため、重複Jobを避けて既存の明示的な「このコマだけ作り直す（1案）」を1回だけ使用した。
- 通常schedulerの遅延中はJobが`queued`／attempt 0のままだったため、既存の`Cloud AI Worker scheduler`を`workflow_dispatch mode=run`で1回だけ起動した。queueは対象1件だけで、workflow run `33036852036`は成功した。
- Jobは`queued`から`completed`へ進み、attempt 1、progress 100、BFL `flux-2-pro`、pricing version `bfl-flux2-pro-2026-08`を確認した。
- 参照Assetは1件。予約は2 credits／`180000` micros、実額は`45000` micros、差額`135000` microsを解放した。
- ledgerは`reserve` 1件と`settle` 1件。予約残高は0、実額はJobとledgerで一致した。
- 出力Assetは1件、同一idempotency Jobは1件、終端後のactive queueは0件だった。
- Production Canvasへ自動配置され、ページrevisionは6／6、残creditは18、予約0を確認した。

## 安全境界

- Prompt、画像、Provider Job ID、API key、Vault値、認証情報を文書・Git・通常ログへ保存していない。
- 直接API送信の試行はブラウザ制約で実行前に失敗し、Job／credit予約は発生しなかった。
- migration以外のDB手動更新、reference binding作成、既存Asset削除、失敗Job再実行、追加生成を行っていない。
- 成人向け境界、Provider／model、retry／timeout、scheduler頻度、価格行、内部credit数を変更していない。

## 残件

1. `docs/STAGING_DURABLE_EXPORT_ACCEPTANCE_RUNBOOK_20260826.md`に従い、staging固定Project 1件でPDF／PNG ZIP／Project JSONを実Storage／Worker受入れする。
2. 中断再開、owner A／B分離、署名URL、cleanup、queue 0、Feature Flag既定OFF復元を確認する。
3. staging受入れ成功後、初期ユーザー向け7完了条件を再集計し、READY／BLOCKEDを最終判定する。
4. 新規コマ生成で費用付き1 Job受入れを直接選べる1案UIは、外部gate完了後の小規模UX候補として扱う。今回のcloseoutでは製品コードを変更しない。

## このPRの範囲

- 外部受入れ証跡と正本文書の同期だけを行う。
- Production／staging、migration、DB、Storage、Provider、Worker、Job、credit、Feature Flagへ追加操作しない。
- 製品コード、テストコード、依存関係を変更しない。

## ローカル検証

- `npm run deps:check`: 成功（module boundary error 0、既知warning 2、size regression 0）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run hub:test`: 916/916成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run desktop:test`: 182/182成功
- `npm run desktop:test:a11y`: violation 0（自動判定不能のcontrast項目はincompleteのまま）
- `npm run db:migrations:validate`: 74 migration／rollback成功
- `npm run build`: 成功
- `npm run desktop:build`: 成功（既知のchunk size warningのみ）
- `npm run rc:preflight`: 正常終了。repository structureはREADY。ローカルに資格情報を置かないため外部設定と手動E2Eはpendingを維持し、staging durable export受入れを未完了のまま扱う。
- `git diff --check`: 成功
