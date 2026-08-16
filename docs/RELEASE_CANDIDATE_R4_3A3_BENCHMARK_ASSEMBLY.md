# RELEASE CANDIDATE: PR-R4-3A-3 Benchmark v2.1 Fixture Assembly

作成日: 2026-08-16

Branch: `codex/feat-r4-3a3-benchmark-assembly`

Base: `feature/manga-canvas-mvp`@`3f121f5da1e998bce3d595ad1ba77261d2b08253`

状態: `IMPLEMENTED_LOCAL / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_HUMAN_REVIEW`

## 結論

権利確認済みCandidate画像を人間2名が独立reviewし、family単位でdev／private holdoutへ分離してBenchmark v2.1 packageを作るローカル専用workflowを実装した。実画像は追加しておらず0/140のままで、strict gateは意図どおり`BLOCKED_FIXTURE_SHORTAGE`で停止する。

Visual Judge、runtime品質判定、自動修復、Provider、Production、既存作品、DB、Storage、Canvas、PNG／PDFは変更していない。

## 監査した既存契約

- PR #291: `ok / unknown / not_evaluated` Evidence、provider-neutral Visual Judge
- PR #292: v2.1 public cases／private labels、4桁ID、dev 112／holdout 28、Production-native profile、Panel Specification、7 defect／6群、strict preflight
- strict入口: `npm run manga:quality:benchmark:strict`
- leak checker: `tests/fixtures/manga-quality/tools/bench_leak_check_v2_1.py`
- checker SHA-256: `3FB2030AAC0884D8051BE45B98F48A5725D7850CDD47A62805E7F865B97213E0`
- v1: `overall=false`のnegative controlのみ
- private領域: dev、holdout、assembly、`.env*`をGit対象外にする

今回指示の`img_000001`は中立名の例と解釈した。PR #292 schemaとPython checkerが確定している`img_0001`形式をversion変更なしに置換していない。

## 実装

- `MANGAI_QUALITY_BENCHMARK_ROOT`でGit外のローカルrootを指定できる。
- assembly manifest、rights ledger、review ledgerを物理分離した。
- 顧客、Production、モニター、成人向け、PII、v1、placeholder、単純変形を明示的なfalse attestationで固定した。
- 権利根拠、benchmark利用許諾、確認者、ローカル証跡を必須化した。
- reviewer A／Bを異なる人間に限定し、不一致時は異なる人間のadjudicatorを必須化した。
- AIを正解label作成者として受け付けない。
- familyのdev／holdout跨ぎ、exact duplicate、flip／色変更等のnear duplicateを停止する。
- 合意率90%以上、Cohen's kappa 0.75以上を正式assembly条件にした。
- v2.1の件数、profile balance、6群coverageを既存readinessで再検査する。
- `assembly:write`は既存dev／holdoutを上書きしない。
- public casesへverdict、defect、review、family、rightsを出力しない。
- leak checkerも同じローカルroot環境変数を利用する。

## 検証結果

| Gate | 結果 |
| --- | --- |
| R4-3A-3集中契約テスト | 7/7 成功 |
| Hub test | 763/763 成功 |
| Canvas test | 26/26 成功 |
| AI test | 48/48 成功 |
| 100ページ受入れ | 4/4 成功 |
| Dependency／module boundary | 成功（既存warning 2件） |
| lint | 成功 |
| Hub typecheck | 成功 |
| migration／rollback | 59/59 成功 |
| research eval | 成功 |
| Cloud漫画repository acceptance | 成功 |
| owner isolation | 成功 |
| Webpack production build | 成功 |
| Turbopack build | `LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT`（Windows path length。差分外） |
| Desktop test／a11y／build | `LOCAL_BLOCKED_EXISTING_DEPENDENCY`（`@napi-rs/keyring`型宣言不足。差分外） |
| assembly non-strict | `BLOCKED_FIXTURE_SHORTAGE`を表示して正常終了 |
| assembly strict | 不足を理由に期待どおり終了コード1 |
| v2.1 preflight non-strict | `BLOCKED_FIXTURE_SHORTAGE`を表示して正常終了 |
| diff check | 成功 |

## 未実施と理由

- 実画像assembly: 権利確認済み画像が未提供のため0/140。
- 人間review: reviewer未割当のため0/280。
- strict v2.1／Python leak acceptance: 140画像とprivate holdoutがないため未実施。
- Production／Provider E2E: 今回の範囲外で、課金とProduction変更を避けるため未実施。

## Production変更なし

- Production DB読取／書込: 0
- Storage読取／書込: 0
- 顧客／モニター／既存作品の取得: 0
- Provider request／課金: 0
- credit予約／確定: 0
- 画像生成／採用／Canvas配置: 0
- migration／RPC／RLS／API／URL／Feature Flag変更: 0

## Merge後の次工程

1. 責任者が利用可能な画像収集元、権利確認者、reviewer A／B、adjudicator、holdout管理者を指定する。
2. Git外rootで140件を収集し、assembly auditを反復する。
3. strict assembly、v2.1 strict、Python leak gateを順に成功させる。
4. 責任者が外部送信範囲、検証予算、Provider比較、fail-closed条件を承認する。

上記が完了するまでPR-R4-3Bへ進まない。
