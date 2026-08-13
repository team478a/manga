# PR-R4-1z 長編一括生成 durable登録

## 結論

4〜8ページ／最大64コマの全対象を、Provider Jobより先に1回のDB transactionで永続登録する。Workerは5分間隔・1回最大3件の既存Schedulerから1対象ずつ取り出し、既存のmonitor枠、user／project rate limit、plan／作品／global予算を変更せずにJob化する。

これにより、1分上限を超える一括生成でも対象コマが途中で失われず、画面を閉じた後も段階生成を継続できる。rate limitの迂回、緩和、batch単位への読み替えは行わない。

## 実装

- `cloud_generation_batch_targets`へpage、panel、元page revision、順序、固定したProvider／model／pricing、moderation済み生成入力、Panel Specificationを保存する。
- 対象tableはRLSを有効化し、`authenticated`へ直接SELECT権限を付与しない。Promptは画面、通常query、ログ、監査ログへ返さない。
- batch開始時は4件ずつ並列で生成条件を準備し、全対象が成功した場合だけ`create_cloud_generation_batch_targets`でbatchとtargetsを原子的に作成する。
- Workerは`FOR UPDATE SKIP LOCKED`でactive batchのpending targetを1件取得する。元page revisionまたはpricingが変わった場合はfail-closedにする。
- Worker transaction内で既存`consume_cloud_general_monitor_ai_request`と`enqueue_cloud_generation_job_with_quota`を呼ぶ。Job、credit／費用予約、rate limit、monitor利用、batch link、Panel Specification、target状態は全成功または全rollbackになる。
- rate limit到達時はtargetをpendingのまま保持し、Workerは`retrying`でtight loopを停止する。次回Schedulerで再試行する。
- quota、設定、元revisionなどの恒久失敗は秘密情報を含まない固定error codeだけを保存し、Creator画面からJob化待ちへ戻せる。
- 一時停止中batchはtargetをJob化しない。中止時は既存Jobを取り消し、pending／failed targetをcanceledへ変更する。

## 外部契約

変更しないもの:

- 公開URL、公開API、Storage bucket／path、Canvas schema、PDF／PNG
- Provider、model、pricing値、credit単価、retry、timeout、Scheduler頻度／1回最大3件
- 既存単発生成、候補比較、採用、再生成、Inpainting／Outpainting
- 成人向け境界、Desktop code

追加するもの:

- migration `202608130001_cloud_generation_batch_targets`
- 非公開target tableと、作成／進捗／再試行／Worker dispatch RPC
- Worker applicationのdurable target dispatcher

## 検証

- PostgreSQL 16: 全53 migration適用、assert、逆順rollback、assert、再適用、assert成功。
- PostgreSQL transaction test: durable targetから既存quota RPCを経由し、Job、batch link、reserve ledger、monitor利用、Panel Specificationを原子的に作成することを確認。test dataはROLLBACKした。
- 集中テスト: batch／preflight／Scheduler／longform 26/26成功。
- Hub 650/650、Canvas 26/26、AI 48/48成功。
- dependency boundary、module boundary、codebase size、lint、全typecheck、migration manifest、diff check成功。
- Hub build: Windows path長上限のため短い物理worktreeで再実行する。
- Desktop統合／a11y: Electron終了待ちでローカル上限。Desktop差分はなく、Windows CIで最終判定する。
- Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: PENDING。

## Rollback

1. Workerを停止または対象batchを一時停止する。
2. deployを直前commitへ戻す。
3. 新targetに実Provider Jobがないことを確認する。
4. `supabase/rollbacks/202608130001_cloud_generation_batch_targets.sql`を適用し、追加RPC／tableを除去して従来のbatch state関数を復元する。

本PRのProduction適用前に作成された旧batchは従来どおり表示できる。Production migration適用前に新UIだけを公開すると新規batch開始はfail-closedになるため、migrationとapplicationを同じreleaseで反映する。

## 次工程

全CIとVercel Preview成功後に停止する。責任者のreview／mergeとProduction migration適用後、R4-1aaで一般向けモニター`test`を使い4ページ限定の実Provider受入れを行う。R4-1aa合格前に8ページ完成原稿／販売品質受入れへ進まない。
