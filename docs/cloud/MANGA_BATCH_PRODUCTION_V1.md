# MANGAI Cloud 2ページPilot／4〜8ページ一括生成・編集ロック

作成日: 2026-08-01

## 目的

32ページ読切を一度に無人生成せず、利用者が連続2ページのPilotまたは4〜8ページを選んで生成を開始し、進捗を確認しながら停止・再開・中止・失敗分再実行できる制作単位を追加する。

## 実装

- ページ番号が連続する2ページPilot、または4〜8ページ、最大64コマに制限した一括生成
- 既存の永続`cloud_generation_jobs`、quota、費用予約、moderation、private Storageを再利用
- BatchとJobの対応をDBへ保存し、ブラウザーを閉じてもQueue処理と進捗を維持
- active／paused／canceled状態と、完了・待機・処理中・失敗件数表示
- paused／canceled BatchのJobをWorker claim対象から除外
- 失敗Jobだけを、保存済み入力のschema検証後に新しい課金予約Jobとして再実行
- Canvas編集開始時に120秒の期限付きleaseを取得し、60秒ごとに更新
- 別画面がleaseを保持している場合は編集面を覆い、同時上書きを防止
- migration未適用時は一覧と編集lockを安全にfallbackし、既存作品の閲覧を維持

## 安全境界

- Batch作成、Job紐付け、状態変更、編集leaseは所有者と編集権限をDBで再確認する。
- Batchはページ番号が連続する重複なし2ページ、または4〜8ページの重複なしIDだけを受け入れる。3ページは受け入れない。
- 2ページPilotも通常batchと同じquota、費用予約、モニター利用枠、人物・画風、Provider・model・料金版、moderationのfail-closed確認を通す。
- 再試行は失敗状態の所有Jobだけを対象にし、DBの生エラーや不正な保存入力を利用者へ露出しない。
- lockはtoken一致時だけ更新・解放でき、異常終了後も期限切れで回復する。
- Provider、料金表、成人向け、Desktop、既存Canvas保存契約は変更しない。

## DB

- Forward: `supabase/migrations/202608010004_cloud_batch_production.sql`
- Rollback: `supabase/rollbacks/202608010004_cloud_batch_production.sql`
- 2ページPilot拡張: `supabase/migrations/202608240001_cloud_generation_two_page_pilot.sql`
- Tables: `cloud_generation_batches`、`cloud_generation_batch_jobs`、`cloud_page_edit_locks`
- RPC: `create_cloud_generation_batch`、`attach_cloud_generation_batch_job`、`replace_cloud_generation_batch_job`、`set_cloud_generation_batch_state`、`acquire_cloud_page_edit_lock`、`release_cloud_page_edit_lock`
- `claim_cloud_generation_job`を更新し、停止中Batchをclaimしない。

## 検証

- migration manifest: 36/36
- PostgreSQL 16 forward／rollback／reapply: 成功
- canonical schema二重適用とassertion: 成功
- 集中テスト: 5/5
- 全体検証: deps、lint、Hub/Desktop typecheck、Hub 359/359、Canvas 26/26、AI 48/48、Desktop 182/182、production build成功
- Draft PR: [#106](https://github.com/team478a/manga/pull/106)
- Preview: `https://mangai-hub-staging-git-agent-manga-ba-fd5369-team478as-projects.vercel.app`
- GitHub CI: Core quality、Migration roundtrip、Windows build、Vercel成功

## 外部作業

- Supabase stagingへmigrationを適用する。
- Previewで連続2ページPilotと4〜8ページ通常batchの開始前見積りを確認する。Provider実生成を伴う開始・停止・再開・中止・失敗分再実行は責任者の明示承認後に行う。
- 同じページを2つのブラウザー画面で開き、後から開いた画面が編集停止になることを確認する。
- 有料Providerの実生成は責任者の明示承認後に行う。
