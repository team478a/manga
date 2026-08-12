# PR-R4-1q モニター制作阻害要因修正

## 目的

2026-08-12のProduction実機検証で確認した次の阻害要因を、外部契約と一般向け境界を維持して解消する。

1. 32ページのAIネーム生成が長時間待機後にtimeoutし、失敗してもモニターAI利用回数が増える。
2. Canvasの品質フィードバックを保存できない。
3. 一般モニター報告を保存できず、本人の送信履歴も一時利用不可になる。

## 基準

- Base: `origin/feature/manga-canvas-mvp` @ `924b833`
- Branch: `codex/fix-r4-1q-monitor-blockers`
- Draft PR: [#235](https://github.com/team478a/manga/pull/235)
- Vercel Preview: https://mangai-hub-staging-git-codex-fix-r4-1-da7543-team478as-projects.vercel.app
- PR #234のbranchと履歴は変更しない。

## 原因

### AIネーム生成

- 変更前は8〜48ページを1回の構造化Responses API応答で生成していた。
- 32ページでは`reasoning.effort=medium`と120秒のProvider timeoutが実データ量に対して不足した。
- モニター利用回数をProvider呼出前に消費していたため、timeoutでも利用回数だけが増えた。

### モニターフィードバック

- 品質評価、構造化報告、本人履歴、管理者一覧は、基本テーブル追加後の3段階の拡張列を前提としている。
- Production症状は、拡張列が参照できない場合に、保存・本人履歴・管理者一覧が同時に失敗する実装と一致する。
- 本修正では本番DB error詳細を利用者へ出さず、列不足だけを互換処理する。RLS違反、制約違反、接続障害は成功扱いにしない。

## 修正

### 1. 長いネーム生成

- GPT-5.6 TerraのmodelとResponses APIは維持する。
- `reasoning.effort`を`medium`から低遅延向けの`low`へ変更する。
- 各説明を1文に抑える指示を追加し、32〜48ページ時の不要な出力量を減らす。
- 8ページ以下は既存どおり1回の構造化応答とし、Provider上限210秒を維持する。
- 9〜48ページは、まず全体の人物・衣装・小道具・場所・感情・伏線と各ブロックの入出状態を45秒以内で設計する。
- 設計後は1〜8、9〜16ページのように8ページ単位へ分割し、全ブロックを並列生成する。各ブロック上限は150秒とし、全体設計45秒＋最遅ブロック150秒をServer Action 240秒内へ収める。
- 32ページは全体設計1回＋4ブロック、48ページは全体設計1回＋6ブロックとなる。ブロック数分の待ち時間を直列加算しない。
- 各ブロックのページ範囲・ページ番号を検証し、結合後に既存の完成版schemaでも総ページ数、全ページ番号、全コマ番号を再検証する。1ブロックでも失敗・欠落・不正なら完成版を返さない。
- `store:false`、構造化output schema、`safety_identifier`を維持する。Background modeは一時保存を伴うため採用しない。
- 上限到達をProvider呼出前に確認し、利用回数の原子的消費は全ブロック成功後・保存前に1回だけ行う。Provider timeoutや一部ブロック失敗では利用回数を増やさない。
- Providerのmodel、単価設定、credit価格は変更しないが、長編1回あたりのProvider request数は増える。出力本体は8ページ単位へ分散し、追加分は小さい全体連続性設計である。
- 本PRは同期処理を安全時間内へ収める分割であり、部分ブロックのDB永続化や非同期再開Jobは追加しない。一部失敗後の再実行は完成版全体の再生成となる。

### 2. フィードバック互換保存

- まず従来どおり全構造化列へ保存する。
- PostgREST `PGRST204`、Postgres `42703`または同等の列不足だけ、基本列へ再保存する。
- 一般報告は種類、影響度、件名を本文先頭へ退避する。
- 品質評価はページ、コマ、判定、問題種別、影響度を本文先頭へ退避する。
- 拡張列がない場合は添付先をDBへ関連付けられないため、アップロード済み添付を削除し、その事実を本文へ残す。
- 本人履歴と管理者一覧も列不足時だけ基本列を読み、退避保存した報告を確認可能にする。

互換保存は既存migrationの代替ではない。構造化集計、添付、進捗通知、自動triageを完全に利用するには次を順番どおり適用する。

1. `202608020002_cloud_general_monitor_quality_feedback`
2. `202608030001_cloud_monitor_operations_hub`
3. `202608030002_cloud_monitor_operations_phase2`

## 維持する契約

- Provider、model選択、API key、pricing、credit価格、retry、Feature Flagは変更しない。
- `store:false`、一般向け限定、成人向け外部送信停止、Prompt・秘密値非表示を維持する。
- DB、migration、RPC、Storage bucket、URL、公開API、Canvas schema、PDF／PNG、Stripe、Desktop codeは変更しない。
- 既存PRのClose、コメント、rebase、force push、mergeは行わない。

## 回帰テスト

- 長編分割集中テスト: 25/25 PASS
- Hub: 639/639 PASS
- Canvas: 26/26 PASS
- AI: 48/48 PASS
- Desktop: 182/182 PASS
- Desktop accessibility: violation 0（既存color contrastはmanual incomplete）
- Desktop accessibility初回は検査結果出力後のElectron終了が`ETIMEDOUT`、単独再実行でexit 0
- deps、lint、Hub／Desktop typecheck、research eval: PASS
- migration validation: 52/52 PASS
- Cloud漫画repository acceptance: PASS
- Hub／Desktop production build: PASS
- RC preflight: STRUCTURE READY（外部設定とmanual項目は従来どおりpending）
- GitHub: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments PASS。Draft／MERGEABLE。

## merge後のProduction再検証

1. testモニターで既存32ページシナリオからネームを1回生成する。
2. 成功時だけAI利用回数が1増えることを確認する。失敗時は増えないことを確認するための意図的な再失敗は行わない。
3. Canvasでページ品質評価を1件保存し、再読込後の履歴を確認する。
4. 一般モニター報告を1件保存し、本人履歴と管理画面一覧の双方で確認する。
5. Production migration適用状況を確認し、未適用なら上記3 migrationを順番どおり適用して構造化列を再確認する。
6. ここまで通るまでR4-2へ進まない。
