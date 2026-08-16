# MANGAI Benchmark v2.1 Human Review Package運用

作成日: 2026-08-17

対象: PR-R4-3A-4

状態: `PILOT_PACKAGE_STRUCTURE_READY / PILOT_INTRINSIC_ONLY / NOT_COUNTED_IN_FORMAL_BENCHMARK`

## 1. 目的と境界

Candidate Visual Benchmarkの人間レビューを、画像単体で判定する`intrinsic_only`と、既存Panel Specification・参照画像との比較が必要な`referential`へ分離する。Reviewer A/Bは正解ラベル、相手の回答、AI監査を見ず、同じschemaで独立評価する。

この工程はVisual Judge、runtime品質判定、自動修復、Provider、Production、DB、Storage、Canvas、PNG／PDF、公開販売を変更しない。AI監査は`reviewer_kind: ai_audit`の別系統であり、`reviewer_kind: human`の代替にしない。

## 2. Review Mode

`intrinsic_only`では、人体・手、object fusion、不要文字・UI・logo、crop、orientation、gravity、readability、otherだけを選択できる。人物同一性、指定構図、指定背景、propは参照情報なしに推測評価しない。

`referential`では、既存`panelSpecificationSchema`に適合する`intended.json`と必要な参照画像を同梱する。人物同一性を選択可能にする場合は、Panel SpecificationのCharacter Identityへbindingされた人物参照画像を最低1枚含める。内部Panel／Character／Asset UUIDは決定的な中立UUIDへ変換し、Production UUIDを出さない。

## 3. private sourceとReviewer ZIP

生成入力は`MANGAI_QUALITY_BENCHMARK_ROOT`配下へ置き、Gitへ追加しない。

```text
ROOT/
  assembly/
    review-package.private.json
    images/img_0001.png
    intended/img_0001.json
    refs/ref_0001.png
  human-review-packages/
    reviewer-a-r4-3a4.zip
    reviewer-a-r4-3a4.source-metadata.private.json
    reviewer-b-r4-3a4.zip
    reviewer-b-r4-3a4.source-metadata.private.json
```

ZIP内のケースIDは`case_000001`形式とし、正式v2.1 assemblyの`img_0001`契約は変更しない。両者の対応、`source_group_id`、`source_family`、character／reference group、splitはZIP外のprivate sidecarへ保存する。同じ`source_family`をdevとprivate holdoutへ分割しない。

Reviewer ZIPには次だけを入れる。

```text
README_JA.md
package-manifest.json
review-order.txt
review-response.private.json
cases/case_000001/candidate.png
cases/case_000001/intended.json       # referentialだけ
cases/case_000001/references/ref_01.png
```

正解label、expected defect／severity、Reviewer A結果、AI結果、Prompt、source生成目的、split、URL、key、token、署名付きURLを含めない。

## 4. 生成と検証

PowerShellではrootを設定して実行する。

```powershell
$env:MANGAI_QUALITY_BENCHMARK_ROOT = "C:\private\mangai-quality-benchmark-v2.1"

npm run manga:benchmark:review-package:build -- `
  --root $env:MANGAI_QUALITY_BENCHMARK_ROOT `
  --source "$env:MANGAI_QUALITY_BENCHMARK_ROOT\assembly\review-package.private.json" `
  --slot reviewer_b `
  --output "$env:MANGAI_QUALITY_BENCHMARK_ROOT\human-review-packages\reviewer-b-r4-3a4.zip"

npm run manga:benchmark:review-package:validate -- `
  --package "$env:MANGAI_QUALITY_BENCHMARK_ROOT\human-review-packages\reviewer-b-r4-3a4.zip"
```

generatorとvalidatorは既存出力を上書きしない。validatorはzip traversal、symlink、expected file、case/order/template集合、checksum、PNG/JPEG/WebP decode、EXIF／禁止PNG text、必須Content Credentials、exact duplicate、mode/category、intended、reference binding、private label、Reviewer A／AI結果、URL／credential、source sidecar、source family splitを検査する。

Provider原画像にC2PA `caBX` chunkがある場合、private sourceの各caseへ`required_provenance_chunks: ["caBX"]`を設定する。generatorはchunkがない入力を拒否し、画像を再エンコードせずZIPへ格納する。validatorはprivate sidecarの要求とZIP内candidateを照合し、欠落時に失敗する。`caBX`は生成元証跡であり、Prompt等を含む禁止PNG text metadataとは扱わない。

## 5. Reviewer Response

回答schemaは`mangai-human-review-v2`で固定する。`reviewer_id`、`reviewer_kind: human`、`independent: true`、offset付きISO 8601、全caseを1回ずつ、confidence 1〜5、severity、normalized bboxを要求する。

```powershell
npm run manga:benchmark:review-response:validate -- `
  --package reviewer-b-r4-3a4.zip `
  --response review-response.private.json
```

`good`はdefect 0、`bad`はdefect 1件以上、`borderline`はdefectまたはoverall commentを要求する。未記入templateは完了回答ではない。

Reviewer A/Bの両方が完了した後だけ比較する。

```powershell
npm run manga:benchmark:review-responses:compare -- `
  --package reviewer-b-r4-3a4.zip `
  --reviewer-a reviewer-a-response.private.json `
  --reviewer-b reviewer-b-response.private.json
```

比較結果はverdict／category／severity agreement、disagreement数、adjudication要否を出す。不一致を多数決で自動確定しない。

## 6. 画像内文字

Panel Specificationが物語上必要な環境文字を明示している場合だけ例外とする。それ以外の生成可読文字、疑似文字、ページ番号、SAMPLE、UI、logo、ゲームUI、操作パネルは不要文字・UI・logoとして判定する。

## 7. 現在の12件Pilot

既存12画像は参照画像と正式Panel Specificationが不足するため、`PILOT_PACKAGE_STRUCTURE_READY / PILOT_INTRINSIC_ONLY / NOT_COUNTED_IN_FORMAL_BENCHMARK`で再生成した。正式140件の0/140は変わらず、人間回答も入力していない。

正式採用には、mode整合、intended、必要参照、Human A/B完了、disagreement裁定、private labels更新、source group、duplicate／leak PASSがすべて必要である。

## 8. rollback

generatorはprivate原画像と既存ZIPを変更しない。誤った派生物はrootと対象名を確認し、該当する新規ZIPと同名private sidecarだけを退避し、source manifest修正後に別名で再生成する。Production側のrollbackは不要である。
