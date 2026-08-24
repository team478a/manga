# P0-A 再開可能な生成基盤schema

作成日: 2026-08-24

Branch: `codex/p0a-resumable-generation-schema`

Base: `109bea32cc2b067a580bb7adb71d9b9960e068b2`（PR #337 merge commit）

## 結論

調査PR #337で承認されたP0-Aとして、既存生成経路を変更せず、再開可能なv2契約の保存先と状態写像だけを追加した。Feature Flagはstrict・既定OFFであり、現行Worker、Provider、quota、credit、Canvas採用は従来動作を維持する。

## 実装

- 既存`cloud_generation_jobs.status`の5値を維持した。
- `execution_phase`、失敗工程、retry区分、HTTP status、親／root Job、workflow version、seed、checkpoint時刻のnullable列を追加した。
- 既存rowは、`running`の実工程を推測せず`unknown`へbackfillする。
- v2の8状態と既存5状態を対応させる純粋domain関数を追加した。
- `cloud_generation_job_events`をappend-only lifecycle event保存先として追加した。
- event metadataは16KiB以下とし、prompt、API key、authorization、signed URL、Provider response bodyの代表的なkeyをDB制約で拒否する。
- event readはownerかつproject edit可能な利用者だけ、insertはservice roleだけにした。
- `CLOUD_GENERATION_RESUMABLE_V2_ENABLED`をstrict・既定OFFで登録した。今回のコードはFlagを参照して書込みを開始しない。

## Migration

- Forward: `202608240002_cloud_generation_resumable_foundation.sql`
- Rollback: 同名rollback。
- Canonical schemaとmanifestを63件へ同期した。
- event row、retry系譜、失敗／checkpoint情報が1件でも使われた後はrollbackを停止する。
- 既存migration履歴、RPC signature、queue index、status check、quota ledgerを変更していない。

## 非変更

- enqueue、claim、heartbeat、retry、cancel、complete RPCの動作。
- Provider interface、Provider選択、model、pricing、timeout。
- Canvas、Panel Specification、品質評価、自動採用、セリフ配置。
- Production DB、Storage、作品、Job、credit。

## 検証

- 集中状態／Flag／migration test: 9/9成功。
- dependency boundary: error 0、既存warning 2。
- lint、Hub／Desktop typecheck成功。
- Hub: 834項目／838 tests成功。
- Canvas: 26/26成功。
- AI: 48/48成功。
- Desktop: 182/182成功。
- Accessibility: violation 0。
- migration manifest: 63件成功。PostgreSQL 16 roundtripはCIで確認する。
- Hub／Desktop build成功。
- RC: repository structure READY。外部設定Pendingとmanual E2Eは既存ローカル環境依存。
- `git diff --check`成功。

## 次

commit、push、Draft PR後、Core quality、Migration roundtrip、Windows build、Vercel Preview成功で停止する。PRレビュー前にP0-BのWorker phase／event書込み、retry chain、構造化errorへ進まない。

Production migration適用、Provider実行、生成Job、credit予約／消費は責任者の個別承認前に行わない。
