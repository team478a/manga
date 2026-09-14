# 品質確認Pilot 第三者裁定設計

更新日: 2026-09-14

対象Batch: `batch_private_01`

状態: `DESIGN_APPROVED / DOMAIN_SLICE_IMPLEMENTED / DATABASE_SLICE_IMPLEMENTED / ADMIN_UI_SLICE_IMPLEMENTED / ADJUDICATOR_UI_SLICE_IMPLEMENTED / ANONYMOUS_EXPORT_AND_PRIVATE_ADAPTER_IMPLEMENTED`

## 1. 目的

完了済み品質確認PilotでPrimary Reviewer A/Bの判定が一致しなかった23件を、既存回答を改変せず、独立した第三者が1件ずつ裁定できるようにする。

この工程は「再レビュー」やPanel多数決ではない。A/Bの独立回答を保存したまま、別の人間による明示的な最終判断と理由を追加する工程である。低い一致率はPilotで得た工程上の結果であり、個々の確認者の能力評価には使用しない。

## 2. 対象と対象外

### 対象

- `case_000003`〜`case_000010`
- `case_000012`〜`case_000020`
- `case_000022`〜`case_000027`

合計23件。verdict、defect category、severityのいずれかがA/B間で異なるため、既存のBenchmark契約に従って裁定を要求する。

### 対象外

完全一致した次の5件には裁定を追加しない。

- `case_000001`
- `case_000002`
- `case_000011`
- `case_000021`
- `case_000028`

また、本設計には次を含めない。

- Production migrationの適用
- 裁定担当者の割り当て、連絡、通知
- A/BまたはPanel回答の変更、削除、再提出
- 候補画像の自動採用、削除、公開
- R4-3B Visual Judgeへの接続
- Provider実行、画像生成、credit予約・消費

## 3. 正本契約との対応

`quality-benchmark-assembly.ts`と既存文書の契約を維持する。

- Primaryは異なる2名の人間による独立確認である。
- 完全一致ケースにはadjudicationを追加しない。
- 不一致ケースにはPrimary 2名と異なる人間のadjudicatorを必須とする。
- 最終ラベルには裁定結果を使用するが、A/Bの中間回答は消さない。
- `good`はdefectなし、`bad`は1件以上のdefect、`borderline`はdefectまたは総合理由を必須とする既存検証を再利用する。

## 4. 裁定担当者

### 適格条件

- 人間である。
- 対象ケースのPrimary Reviewer A/Bのどちらでもない。
- 権限を付与された品質責任者、管理者、または専任の第三者確認担当である。
- 対象Batch、守秘義務、画像の利用範囲に同意している。

Panel Reviewer C以降を担当者候補にすることはできるが、既存Panel回答を裁定結果へ自動変換してはならない。Panel回答は独立した補助票のまま保存し、裁定は別の割り当て、別の入力、別の確定操作として記録する。

### 独立性

担当者は、最初の判断を確定するまでA/Bの回答内容、他Panelの回答、集計傾向を見られない。既存Panel担当者を裁定へ割り当てる場合も、その人自身の提出済みPanel回答は変更せず、裁定用の独立判断を新規に入力する。

## 5. Blind-first / compare-second

1. 担当者は候補画像、同じ`intrinsic_only`の確認条件、許可されたdefect categoryだけを見る。
2. verdict、confidence、defects、短い独立理由を入力する。
3. 「独立判断を確定」で初回判断をimmutableにする。確定後の上書きは許可しない。
4. 確定後にだけ、氏名を除いたA/Bのverdict、category、severityの差分を表示する。自由記述は既定で表示しない。
5. 担当者はA案、B案、または第三の判断を選び、最終verdict、defects、裁定理由を確定する。
6. 最終確定後は通常編集を不可にする。訂正が必要な場合は旧記録を残したままrevokeし、新しい裁定割り当てを作る。

先にA/B差分を見せないことでアンカリングを抑え、独立判断と最終判断の差も監査可能にする。

## 6. 状態機械

裁定割り当ては次の状態を持つ。

- `assigned`: 担当者へ割り当て済み
- `in_progress`: 同意済み、またはdraft保存済み
- `independent_locked`: 独立判断を確定済み、A/B差分を閲覧可能
- `submitted`: 最終裁定を確定済み
- `abstained`: 判断不能として理由を確定済み
- `revoked`: 管理者が無効化。回答は削除しない

許可する主遷移は`assigned -> in_progress -> independent_locked -> submitted`である。`abstained`は`in_progress`または`independent_locked`からだけ許可する。`revoked`は管理者操作と理由を必須にし、既存記録を削除しない。

同じBatch・caseに有効な割り当ては同時に1件だけとする。更新は期待する現在状態との一致条件とidempotency keyを必須にし、二重送信・複数タブ競合をfail closedで拒否する。

## 7. 保存設計

追加migrationで専用テーブルを作る。既存migration、Batch、case、assignment、response行は変更しない。

### `cloud_monitor_quality_review_adjudications`

最低限、次を保存する。

- `id`
- `batch_id`
- `case_id`
- `adjudicator_profile_id`（private、匿名exportへ含めない）
- `status`
- `independent_payload`
- `independent_locked_at`
- `final_payload`
- `decision_reason`
- `response_fingerprint`
- `assigned_by_profile_id`
- `consented_at`
- `submitted_at`
- `revoked_at`
- `revoked_by_profile_id`
- `revocation_reason`
- `created_at`
- `updated_at`

`independent_payload`と`final_payload`は既存Human response契約のcase単位部分集合を再利用し、未知フィールドを拒否する。APIキー、Prompt、画像本体、メール、氏名は保存しない。

### `cloud_monitor_quality_review_adjudication_events`

assignment、consent、draft、independent lock、A/B差分開示、finalize、abstain、revokeをappend-onlyで記録する。イベントには主体、対象、遷移、idempotency key、時刻を保存するが、回答本文、自由記述、個人メール、画像を通常ログへ複製しない。

### 制約

- activeな`batch_id + case_id`は一意。
- adjudicatorは対象ケースのPrimary A/Bと異なる。
- 対象caseは匿名集計が返した23件に限る。完全一致5件を拒否する。
- Batchは`completed`のまま維持する。裁定のため`active`へ戻さない。
- `submitted`後のpayload更新を拒否する。
- A/BとPanelのresponse行はimmutableのまま維持する。

## 8. 権限と個人情報

- テーブルへの直接アクセスはrevokeし、管理者サーバーと裁定担当本人向けSecurity Definer RPCだけを許可する。
- RPCは`auth.uid()`、profile、role、割り当て、現在状態、Batch、caseを毎回再検査する。
- 管理者以外は他担当者の存在や進捗を取得できない。
- 裁定担当者は独立判断確定前にA/B差分取得RPCを利用できない。
- キャッシュは`private, no-store`とする。
- 管理画面、download名、匿名JSON、通常ログへ氏名、メール、profile ID、assignment IDを出さない。
- privateな正式assemblyを作る場合の`adjudicator_id`は、Git外のprivate rootで仮名へ変換し、Production profile IDを直接書き出さない。

## 9. 画面設計

### 管理画面

- Batchは`completed`表示を維持し、派生状態として`needs_adjudication`と`23件中N件確定`を表示する。
- 23件だけを対象に、適格な1名を割り当てる操作を置く。
- 割り当て前に、対象件数、担当者の独立性、外部送信有無、通知有無を明示して確認する。
- `submitted`、`abstained`、`revoked`を分けて表示する。
- 匿名集計と匿名裁定JSONを保存できる。
- A/BまたはPanelの個人別成績ランキングを表示しない。

### 裁定画面

- 1画面1ケースを基本にし、スマートフォンで画像拡大、途中保存、再開を可能にする。
- 独立判断の確定前後を明確に分ける。
- 確定操作には確認画面を置き、誤操作によるロックを防ぐ。
- A/B差分開示後も元の独立判断を常に参照できる。
- 通信失敗時はdraftを失わず、同じidempotency keyで安全に再送する。

## 10. 最終判定

裁定者はA、Bのいずれかへ同意してもよく、双方と異なる第三の判断も選べる。多数決ではなく、画像と定義に基づく理由を必須とする。

- 23件すべてが`submitted`になるまで`needs_adjudication`。
- 1件でも`abstained`、有効担当なし、契約違反があれば`adjudication_blocked`。
- 23件が有効に確定すれば`pilot_adjudication_complete`。

裁定完了は、事前のA/B一致率やkappaを遡及的に改善しない。今回のPilotは28画像・Primary 56回答であり、正式Benchmark要件140画像・独立回答280件を満たさないため、常に`formalBenchmarkEligible=false`とする。裁定結果から候補画像を自動採用・削除しない。

## 11. 出力

匿名裁定summaryには次だけを含める。

- schema version
- batch code
- case key
- status
- independent verdict
- final verdict
- final defect category／severity
- 完了件数、未完了件数、abstain件数
- derived decision

氏名、メール、profile／assignment ID、自由記述、回答時刻は含めない。管理者のprivate exportと正式assembly用ledgerは別物とし、public artifactを作らない。

管理画面の「匿名裁定JSONを保存」は、`private, no-store`かつ`nosniff`のdownloadとして提供する。出力schemaは許可項目だけを持つstrict schemaであり、repositoryの専用取得も`case_id`、状態、独立payload、最終payload以外の裁定列を取得しない。payload内のconfidence、bbox、自由記述はサーバー内検証にだけ使い、downloadへコピーしない。

正式assembly互換recordへの変換はWeb routeから行わない。Git外の`MANGAI_QUALITY_BENCHMARK_ROOT`内に、Production IDを含まない明示的な仮名、`case_XXXXXX -> img_XXXX`対応、Primary A/B回答、裁定結果をoperatorが準備し、次を実行する。

入力例は`tests/fixtures/manga-quality/examples/monitor-adjudication-private-assembly.example.json`を正本にする。匿名裁定downloadをそのまま入力にはできない。管理者がprivateに保持するPrimary A/B回答と裁定結果を照合し、Productionのprofile／assignment／adjudication UUIDを除去して中立仮名へ置換した後にだけ入力を作る。

```powershell
$env:MANGAI_QUALITY_BENCHMARK_ROOT = "C:\private\mangai-quality-benchmark-v2.1"
npm run manga:benchmark:monitor-adjudication:adapt -- `
  --source "monitor-adjudication\source.private.json" `
  --output "monitor-adjudication\assembly-records.private.json"
```

CLIはroot外path、repository内の非ignore領域、URL、メール、token、Production UUID、UUID由来の`monitor_...`識別子、Primaryと裁定者の重複、変換不能defect、既存output上書きを拒否する。`assembly/reviews.private.json`へは直接書かず、出力wrapperを`pilot_only=true`、`formal_benchmark_eligible=false`、`automatic_import=false`に固定する。正式ledgerへ組み込む判断は、画像・権利・140画像・280独立回答を別途検証する既存assembly工程でのみ行う。

## 12. migrationとrollback

- 新しい連番のadditive migrationだけを追加する。
- canonical schema、checksum、migration validatorを同期する。
- rollbackは裁定行・イベント行が0件の場合だけdropできる。
- 1件でも保存済みなら自動削除せず、件数を返して停止する。
- Production適用は実装PRのmergeと責任者の実行時承認を別々に必要とする。

## 13. テスト計画

### Domain

- 全状態遷移と不正遷移
- Primary A/Bと同一人物の拒否
- 完全一致5件への裁定追加拒否
- 不一致23件の集合固定と欠落検出
- verdictとdefectsの既存整合性
- submitted後のimmutable保証
- abstain時の完了阻止
- 裁定後もagreement／kappaを変更しないこと
- `formalBenchmarkEligible=false`維持

### DB / Security

- RLS、Security Definer RPC、role、本人割り当ての検査
- 直接table write拒否
- A/B差分の早期開示拒否
- active割り当て一意性
- expected state、idempotency、複数タブ競合
- A/B、Panel回答が更新されないこと
- append-only eventと回答本文非記録
- migration validationとroundtrip rollback

### UI / Export

- 23件の進捗と5件除外表示
- mobile viewport、キーボード操作、読み上げ、拡大
- draft復元と通信失敗再送
- 独立判断確定前後の画面境界
- 匿名summary／downloadにPII、自由記述、時刻が含まれないこと
- 裁定完了後も自動採用・削除APIが呼ばれないこと

## 14. 実装分割

1. Domain schema、状態機械、派生判定だけを追加する。DB・UIは変更しない。
2. additive migration、RLS、RPC、rollback、migration testを追加する。
3. 管理者の割り当て・進捗・停止画面を追加する。
4. 裁定担当者のBlind-first / compare-second画面を追加する。
5. 匿名exportとprivate assembly adapterを追加する。
6. merge後、Production migration適用、担当者割り当て、案内、23件裁定をそれぞれ責任者承認付きの別工程で行う。

各PRは既存回答・画像を保存し、Production未変更、Provider未実行、credit未消費を既定とする。

Productionで実装分割6を実行する際の工程別preflight、postflight、承認点、停止条件、証跡は`docs/quality-benchmark-monitor-adjudication-production-runbook.md`を正本とする。

## 15. 次の承認点

設計、Domain、DB基盤、管理画面、担当者画面はmerge済みである。実装分割5として、管理者向け匿名裁定downloadとGit外private assembly adapterを追加した。匿名downloadは個人情報・自由記述・時刻を出さず、adapterは明示的な中立仮名だけを受け付け、現在のPilotを正式Benchmarkへ自動昇格しない。

次は本PRの全CI／Vercel Preview成功後に停止する。merge後のProduction migration適用、実際の担当者割り当て、通知、裁定開始、private adapterへの実データ投入は、それぞれ該当工程で責任者が明示承認するまで実施しない。
