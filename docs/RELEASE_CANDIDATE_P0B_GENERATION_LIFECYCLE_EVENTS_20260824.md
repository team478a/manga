# P0-B 生成lifecycle・再試行系譜

作成日: 2026-08-24

Branch: `codex/p0b-generation-lifecycle-events`

Base: `e6929d31cf0823bd6d0814b652b1c534df13509d`（PR #338 merge commit）

## 結論

strict既定OFFの`CLOUD_GENERATION_RESUMABLE_V2_ENABLED`有効時だけ、既存Workerのpreparing、generating、validating、succeeded、failedをP0-A schemaへ記録する。記録障害は課金対象Provider処理を繰り返さず、現行Job結果を優先する。

## 実装

- lifecycle mutationを純粋domain関数へ分離し、attemptを0〜100、HTTP statusを100〜599へ限定した。
- Workerの工程、automatic retry、final failure、Provider継続poll、完了をappend-only eventへ記録する。
- Provider errorは安全なcode、message、retryable、failure stage、数値HTTP statusだけへ分類する。
- event metadataは空objectを標準とし、prompt、画像、signed URL、response bodyを渡さない。
- 手動retryはowner、project、page、source failed、retry queuedをDB RPCで検証し、parent／root Job系譜を原子的に保存する。
- retry系譜保存に失敗した場合は新Jobをcancelしてcredit予約を解放し、未関連Jobを実行させない。

## Migration

- `202608240003_cloud_generation_retry_lineage.sql`とrollbackを追加。
- canonical schemaとmanifest 64件を同期。
- 既存RPC signature、status、queue、Provider、料金契約は変更していない。

## 検証

- 集中15/15成功。
- deps error 0（既存warning 2）、lint、全型検査成功。
- Hub 838項目／842 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0。
- migration 64件、Hub／Desktop build、RC structure、diff check成功。
- PostgreSQL roundtripはCIで確認する。

## 不変

- Feature Flagは既定OFF。Productionでは新lifecycle書込みを開始しない。
- Production migration、Provider、Worker、Job、作品、Storage、Canvas、credit操作0件。
- 次はDraft PRの全CI／Vercel成功で停止し、P0-Cはレビュー前に開始しない。
