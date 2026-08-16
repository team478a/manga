# MANGAI 漫画品質エンジン・ベンチマーク設計 v2.1

作成日: 2026-08-16

対象: PR-R4-3A2（PR-R4-3A契約修正）

状態: `IMPLEMENTED_LOCAL / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_SKLEARN`

## 1. 結論

PR #291の評価基盤は再利用するが、旧30〜50画像manifestは正式Benchmarkに使わない。v2.1ではCandidate画像単体のVisual BenchmarkをPage/Canvas Benchmarkから分離し、dev 112件とprivate holdout 28件、合計140件を正本とする。

現在のリポジトリにはv2.1実画像がない。添付された旧v1の実測結果はlabel leakageを検出したnegative controlであり、精度測定用データへ昇格させない。Production作品、既存32ページ作品、顧客画像、架空画像で不足を埋めない。

## 2. PR #291から維持する契約

- `ok / unknown / not_evaluated`を区別し、未評価を点数へ変換しないEvidence契約
- VLM、embedding、detector、hybridを同じ方法で比較するprovider-neutral `MangaVisualJudge`
- critical recall、false positive、failure一致、Evidence coverage、Judge費用、遅延の独立集計
- 現在の`panelSpecificationSchema`を期待内容のsource of truthにする
- 既存runtime Judge、DB、RPC、RLS、ranking、auto adopt、repair、Providerを変更しない

## 3. v2.1 package契約

```text
DEV_ROOT/
  manifest.json
  cases.json                 # Visual Judgeへ渡せる公開入力だけ
  labels.private.json        # evaluator-only
  images/img_0001.png
  refs/
  intended/img_0001.json

HOLDOUT_ROOT/                # threshold調整担当から隔離
  ...same layout...
```

### 3.1 公開領域

`manifest.json`はversion、dataset、split、Production-native image profile、画像ID、label-neutral path、SHA-256だけを持つ。`cases.json`はcandidate画像、`intrinsic / referential`、profile、reference、intendedへの参照だけを持つ。verdict、defect、severity、review情報は置かない。

画像は`images/img_0001.png`形式のPNGとし、Prompt、workflow、comment、generation parametersをPNG text metadataへ残さない。manifestのSHA-256と実ファイル、profileの幅・高さは完全一致させる。dev/holdout間のexact duplicateは禁止する。

### 3.2 intended

`intended/*.json`は既存の`panelSpecificationSchema`をそのまま内包する。独自の類似schemaを作らない。referential caseは`referenceBindings`と`refs/`の実ファイルを一致させる。

### 3.3 非公開ラベル

各ケースは`good / bad / borderline`のverdictを持つ。badには次の6大分類から1件以上のdefectを付ける。

1. character identity mismatch
2. anatomy / object fusion
3. unwanted text / UI / logo
4. composition / crop error
5. orientation / gravity error
6. background / prop mismatch

2名以上が独立してreviewし、不一致はadjudicationする。合意率90%以上、Cohen's kappa 0.75以上を推奨する。note、bbox、reviewer情報はprivate labelsから外へ出さない。

## 4. 正式件数

| split | good | bad | borderline | total |
| --- | ---: | ---: | ---: | ---: |
| dev | 48 | 48 | 16 | 112 |
| private holdout | 12 | 12 | 4 | 28 |
| combined | 60 | 60 | 20 | 140 |

6大分類はcombined bad内で各10件以上にする。各image profile内のgood/bad件数差は1以内とする。固定短辺1024へのupscaleは行わず、Productionが実際に出力するprofileをmanifestに固定する。

## 5. taxonomy互換性

Visual Benchmark語彙と既存runtime failure語彙は同一ではない。R4-3A2は意味が一致する項目だけをnullable mappingで返す。

- `text_artifact`を`text_area_collision`へ強制変換しない
- `orientation_error / gravity_error`を`other`へ強制変換しない
- fusion、cropも意味が一致しない既存分類へ丸めない

DB enum、UI、runtime保存値は変更せず、対応のない項目は`null`として後工程の仕様判断へ残す。

## 6. leak / shortcut gate

構造preflightは次を検査する。

- public/privateの物理分離、strict schema、ID集合一致
- label-neutral path、path traversal、PNG metadata
- SHA-256、実寸、Production profile
- intendedのPanel Specification、refsの存在
- splitの厳密件数、profile別class balance、6分類coverage
- dev/holdout exact duplicate

Python acceptanceは`scikit-learn`を必須とし、次を判定する。

- 各low-level特徴のunivariate AUC `< 0.65`
- dev 5-fold CV balanced accuracy `<= 0.60`
- private holdout balanced accuracy `<= 0.60`
- sharpness/filesizeのgood/bad差20%超はwarningとして人手確認

`npm run manga:quality:benchmark:preflight`は不足を表示し終了コード0、`npm run manga:quality:benchmark:strict`は不足時に終了コード1とする。最終Acceptanceは`npm run manga:quality:benchmark:leak`も成功させる。

## 7. v1 negative control

添付結果`tests/fixtures/manga-quality/evidence/v1_leak_result_v2_1.json`は`overall=false`である。主な値はaspect ratio AUC 1.0、sharpness AUC 0.981、filesize AUC 0.944、dev CV balanced accuracy 1.0、path leakage 33件である。

旧v1実画像は添付されていないためローカル再実行はできない。このJSONを合格証跡やv2.1精度の代用にしない。

## 8. VLM等の比較方針

同じdev fixtureに対してprovider-neutral VLM、ローカルOCR、必要に応じembeddingを比較する。private holdoutはthreshold調整後にevaluatorだけが実行する。価格表の推定ではなく、実請求と対応するJudge cost、latency分布、Evidence coverage、critical recall、false positiveを記録する。

R4-3A2では外部Providerを呼び出さず、model、pricing、credit、retry、timeoutを変更しない。

## 9. R4-3B前の停止条件

1. 権利確認済み140画像とProduction-native profileが揃う。
2. 全ケースを2名以上がreviewし、不一致をadjudicationする。
3. devとprivate holdoutを別担当・別配布経路で隔離する。
4. strict構造preflightとPython shortcut gateが成功する。
5. devでVLM／OCR／embeddingの精度・費用・遅延を比較する。
6. 外部送信範囲、Provider、検証予算、採用閾値、unknown時のfail-closedを責任者が承認する。

現在は1〜6が未完了である。Draft PRとCI／Preview確認後に停止し、責任者確認前にPR-R4-3Bへ進まない。
