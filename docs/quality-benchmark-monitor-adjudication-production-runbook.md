# 品質確認Pilot 第三者裁定 Production運用ランブック

更新日: 2026-09-14  
対象Batch: `batch_private_01`  
正本設計: `docs/quality-benchmark-monitor-adjudication.md`

## 1. 目的と境界

完了済み品質確認BatchのPrimary Reviewer A/B不一致23件について、既存回答と画像を保持したまま、独立した第三者によるBlind-first / compare-second裁定を安全に開始・監視・完了する。

本ランブックは次の5工程を分離する。

1. Production migration適用
2. 裁定担当者の割り当て
3. 担当者への開始案内
4. 23件の裁定実施と進捗監視
5. 匿名exportとGit外private assembly準備

各工程は、直前の状態をread-onlyで確認したうえで、その工程だけの責任者による実行時明示承認を必要とする。前工程の承認を後工程へ流用しない。migration適用、割り当て、案内、回答、private実データ投入を一括実行しない。

このPilotは28画像・Primary独立回答56件であり、正式Benchmark要件の140画像・280独立回答を満たさない。全裁定が完了しても`formalBenchmarkEligible=false`、`automaticAdoption=false`を維持し、候補画像の自動採用・削除、元回答の上書き、agreement／kappaの遡及変更を行わない。

## 2. 役割

- 責任者: 各Production変更または外部送信を、その時点の証跡を見て承認する。
- 運用担当: 対象Project、Batch、件数、期待状態を再確認し、承認された1工程だけを実行する。
- 裁定担当者: Primary A/Bと異なる本人アカウントで、独立判断を先に確定し、その後に匿名差分を確認して最終裁定または辞退を行う。
- 開発担当: 実装・migration・画面のCI証跡を提示する。Productionデータを開発用fixtureやGitへ取り込まない。

同一人物が複数の役割を兼ねる場合も、操作単位と承認点は分離する。

## 3. 共通の事前条件

全工程で次を満たさない場合は停止する。

- 作業対象がProduction Projectであることを画面上のProject名とProject refで二重確認した。
- 操作者が管理者本人であり、共有画面や他人のセッションではない。
- Productionの復旧可能なバックアップと取得時刻を確認した。
- PR #459〜#462が本線へmerge済みで、merge commitのRequired Quality、Migration roundtrip、Desktop Windows、Vercelが成功している。
- Batch codeが`batch_private_01`、Batch状態が`completed`、画像28件、確認者5名、確定回答140件である。
- Primary A/B不一致が23件、完全一致が5件である。
- Provider、画像生成、credit、採用・削除操作を同時に実施しない。
- SQLや画面の結果へメール、氏名、自由記述、Prompt、画像、token、秘密値を表示・保存しない。

ブラウザのタブが複数ある場合は対象Project以外のSupabase SQL Editorを閉じ、未保存SQLが残っていない新規Queryを使う。実行前にSQL全文を読み直し、選択範囲だけの実行は行わない。

## 4. 工程1: Production migration

### 4.1 承認前のread-only確認

次の確認ではProductionを変更しない。

```sql
begin read only;

select
  b.batch_code,
  b.status,
  b.target_reviewer_count,
  count(distinct c.id) as case_count,
  count(distinct a.reviewer_profile_id) as reviewer_count,
  count(distinct r.id) filter (
    where a.status = 'submitted'
      and a.submitted_at is not null
      and r.case_completed_at is not null
  ) as completed_response_count
from public.cloud_monitor_quality_review_batches b
left join public.cloud_monitor_quality_review_cases c on c.batch_id = b.id
left join public.cloud_monitor_quality_review_assignments a on a.batch_id = b.id
left join public.cloud_monitor_quality_review_responses r on r.assignment_id = a.id
where b.batch_code = 'batch_private_01'
group by b.id, b.batch_code, b.status, b.target_reviewer_count;

select
  to_regclass('public.cloud_monitor_quality_review_adjudications') as adjudications_table,
  to_regclass('public.cloud_monitor_quality_review_adjudication_events') as events_table,
  to_regprocedure('public.assign_cloud_monitor_quality_review_adjudication(uuid,uuid,uuid,uuid,text)') as assign_rpc;

commit;
```

期待値は`completed / 5 / 28 / 5 / 140`である。0件、複数Batch、件数差、別状態があればmigrationを適用しない。既に3つの裁定objectが存在する場合は再適用せず、4.3のpostflightだけを行う。

### 4.2 適用

責任者が「Production migration適用」をその時点で明示承認した場合だけ、merge済み本線の`supabase/migrations/202609140003_cloud_monitor_quality_review_adjudication.sql`を全文そのまま1回適用する。途中編集、別migrationとの結合、rollbackとの同時実行を行わない。

失敗時は同じSQLを反射的に再実行しない。エラー、対象Project、実行時刻、トランザクションがrollbackされたことを記録し、状態をread-onlyで再確認する。

### 4.3 postflight

```sql
begin read only;

select
  c.relname,
  c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'cloud_monitor_quality_review_adjudications',
    'cloud_monitor_quality_review_adjudication_events'
  )
order by c.relname;

select
  to_regprocedure('public.assign_cloud_monitor_quality_review_adjudication(uuid,uuid,uuid,uuid,text)') is not null as assign_rpc,
  to_regprocedure('public.consent_cloud_monitor_quality_review_adjudication(uuid,text)') is not null as consent_rpc,
  to_regprocedure('public.save_cloud_monitor_quality_review_adjudication_draft(uuid,jsonb,text)') is not null as draft_rpc,
  to_regprocedure('public.lock_cloud_monitor_quality_review_adjudication_independent(uuid,jsonb,text)') is not null as lock_rpc,
  to_regprocedure('public.reveal_cloud_monitor_quality_review_adjudication_differences(uuid,text)') is not null as reveal_rpc,
  to_regprocedure('public.submit_cloud_monitor_quality_review_adjudication(uuid,jsonb,text,text)') is not null as submit_rpc,
  to_regprocedure('public.abstain_cloud_monitor_quality_review_adjudication(uuid,text,text)') is not null as abstain_rpc,
  to_regprocedure('public.revoke_cloud_monitor_quality_review_adjudication(uuid,uuid,text,text)') is not null as revoke_rpc;

select
  (select count(*) from public.cloud_monitor_quality_review_adjudications) as adjudication_count,
  (select count(*) from public.cloud_monitor_quality_review_adjudication_events) as event_count;

select
  has_table_privilege('authenticated', 'public.cloud_monitor_quality_review_adjudications', 'select') as authenticated_direct_select,
  has_table_privilege('authenticated', 'public.cloud_monitor_quality_review_adjudications', 'insert') as authenticated_direct_insert,
  has_table_privilege('authenticated', 'public.cloud_monitor_quality_review_adjudications', 'update') as authenticated_direct_update,
  has_table_privilege('authenticated', 'public.cloud_monitor_quality_review_adjudications', 'delete') as authenticated_direct_delete;

commit;
```

期待値は、2テーブルともRLS有効、8 RPCすべて`true`、裁定・eventとも0件、`authenticated`の直接table権限4項目がすべて`false`である。ここまで確認しても担当割り当ては行わない。

rollbackは裁定・eventが0件の場合だけ検討できる。1件でも存在すればguardが停止するため、SQLを改変して強制dropしない。

## 5. 工程2: 担当者割り当て

別の実行時承認を受けるまで割り当てない。承認前に管理画面で次だけを確認する。

- `/admin/general-monitors/quality-review`で対象Batchが`completed`のまま表示される。
- 派生状態が`needs_adjudication`で、不一致23件、裁定済み0件である。
- 割当候補は対象caseのPrimary A/B本人ではない。
- 1 caseにつき有効な裁定担当は1名だけである。
- この操作ではメール・LINE・アプリ通知などの外部送信を行わない。

責任者が対象者と対象件数を明示承認した場合だけ、管理画面から割り当てる。最初は1件だけをcanaryとして割り当て、次をread-onlyで確認する。

- 状態が`assigned`で1件だけ増えた。
- `assigned` eventが1件だけ増えた。
- Primary A/B回答56件、全回答140件、画像28件、Batch状態`completed`が不変である。
- 二重割当が拒否される。

canary確認後も、残り22件の割り当てには別途対象範囲を明示した承認を必要とする。一括割当を暗黙に開始しない。

## 6. 工程3: 開始案内

割り当ては通知の承認を含まない。担当者へのメール、アプリ通知、LINE、Chatworkその他の外部送信は、宛先、件名、本文、送信件数を責任者へ提示し、送信の実行時承認後に行う。

案内には次を含める。

- 先行販売購入者として協力する限定品質確認Pilotであること。
- 品質確認ページのProduction URLとログイン方法。
- 対象件数、期限、途中保存・再開方法。
- 最初はA/B回答を見ず独立判断を確定し、その後だけ匿名差分を確認すること。
- 独立判断は確定後に変更できないこと。
- 判断不能時は無理に決めず、理由を付けて辞退できること。
- Prompt、画像、回答、URLを第三者へ共有しないこと。
- 問題時の連絡先と停止案内。

送信後は宛先本文を通常ログへ複製せず、送信種別、件数、時刻、成功・失敗だけを記録する。失敗した宛先だけを再送し、全員へ重複送信しない。

## 7. 工程4: 裁定実施と監視

裁定回答は担当者本人の操作でのみ保存する。管理者が代理入力したり、Primary／Panel回答から自動生成したりしない。

毎日の監視では管理画面の集計だけを確認し、回答本文や個人成績一覧を収集しない。

- `assigned`
- `in_progress`
- `independent_locked`
- `submitted`
- `abstained`
- `revoked`
- 不一致23件中の確定件数

1件でも次に該当すれば新規操作を停止する。

- 独立判断確定前にA/B差分が見える。
- Primary A/B本人へ割り当てられる。
- 同一caseに複数の有効割当がある。
- `submitted`後の回答が変更できる。
- Batch、元回答、画像、採用状態が変化する。
- 本人以外の裁定、画像、進捗が取得できる。
- 通常ログ、download、URLへPII、自由記述、Prompt、画像、tokenが露出する。

問題時は管理画面の理由付き停止を使用する。revokeは回答やappend-only eventを削除しない。修正後に再割当する場合も別の実行時承認を得る。

23件すべてが`submitted`なら派生判定は`pilot_adjudication_complete`になる。1件でも`abstained`、有効担当なし、契約違反があれば`adjudication_blocked`として扱い、自動的に完了へ丸めない。

## 8. 工程5: exportとprivate assembly

匿名裁定JSONは管理画面の「匿名裁定JSONを保存」から取得する。ダウンロード後、schema version、Batch code、23件、状態、匿名判定、件数、派生判定だけが含まれ、氏名、メール、profile／assignment／adjudication ID、自由記述、confidence、bbox、時刻が含まれないことを確認する。

匿名downloadはprivate assemblyの直接入力ではない。Productionのprivate回答をGit外で仮名化し、case対応を明示した実入力を作る作業は、保存先、担当者、利用目的、廃棄方法を示した別の明示承認後にだけ行う。

adapter実行時は`MANGAI_QUALITY_BENCHMARK_ROOT`をGit外の専用rootへ設定し、既存ファイルを上書きしない。出力は`pilot_only=true`、`formal_benchmark_eligible=false`、`automatic_import=false`であり、canonical `assembly/reviews.private.json`へ直接書かない。

## 9. 証跡テンプレート

各工程で次を記録する。秘密値、PII、回答本文、画像は記録しない。

```text
工程:
実行時刻（JST / UTC）:
対象Project名 / Project ref照合: 済・未
対象Batch code:
開始前の期待状態:
責任者の実行時承認:
実行した操作:
変更件数:
不変確認（Batch / case / assignment / response / image）:
終了状態:
停止条件の発生: なし・あり
次工程の承認: 未取得
```

## 10. 完了条件

- 23件が有効な`submitted`で、派生判定が`pilot_adjudication_complete`である。
- Batchは`completed`、Primary回答56件、全回答140件、画像28件を維持する。
- 元の完全一致率とCohen's kappaを変更しない。
- `formalBenchmarkEligible=false`、自動採用・削除なしを維持する。
- 匿名exportに禁止項目がなく、private実データをGitへ保存していない。
- 各Production変更と外部送信に個別の実行時承認と証跡がある。

これらを満たさない場合はPilotを「完了」と報告しない。
