# MANGAI Benchmark v2.1 Fixture Assembly運用

作成日: 2026-08-16

対象: PR-R4-3A-3

状態: `IMPLEMENTED_LOCAL / BLOCKED_FIXTURE_SHORTAGE / BLOCKED_HUMAN_REVIEW`

## 1. 目的と境界

Candidate Visual Benchmark 140件を、権利、画像品質、人手ラベル、family分離、漏洩防止を確認してv2.1 packageへ変換する。収集物とprivate情報はローカル専用rootへ置き、Git、Production DB、Storage、既存作品へ保存しない。

この工程はVisual Judgeを実行しない。画像生成、runtime品質判定、自動修復、Provider、model、pricing、credit、Canvas、PNG／PDF処理も変更しない。Page / Canvas Benchmarkは別工程であり、空吹き出しやセリフ未配置を今回のCandidate欠陥に含めない。

## 2. ローカル専用root

`MANGAI_QUALITY_BENCHMARK_ROOT`へ専用フォルダを指定する。未設定時は後方互換の`tests/fixtures/manga-quality/v2.1`を使うが、この配下はgitignore対象である。

```powershell
$env:MANGAI_QUALITY_BENCHMARK_ROOT = "C:\private\mangai-quality-benchmark-v2.1"
```

rootは次の構造にする。

```text
ROOT/
  assembly/
    manifest.private.json
    rights.private.json
    reviews.private.json
    images/img_0001.png
    intended/img_0001.json
    refs/ref_0001.png
    rights/rights_0001.json
  dev/                    # assembly:writeの派生出力
  holdout-private/        # evaluatorだけが保持する派生出力
```

例は`tests/fixtures/manga-quality/examples/`にある。例示JSONだけをcopyし、実画像、権利資料、review、private labelをGitへ追加してはならない。

## 3. 収集契約

各ケースはPR #292の既存契約どおり`img_0001`形式の中立IDを使う。今回指示にある`img_000001`は中立命名の例であり、v2.1 checkerとschemaが確定済みの4桁形式を無断変更しない。

収集台帳では次を必須にする。

- `family_id`: 同一作品、同一生成系列、同一原画系列を一つにまとめる。同じfamilyをdevとholdoutへ分けない。
- `source_group_id` / `source_family`: 生成元と生成batchを保持する。同じsource familyをdevとholdoutへ分けない。
- `character_group_id` / `reference_group_id`: 同一人物・同一参照系列をprivate metadataで追跡する。該当しない場合だけ`null`とする。
- `derivation: independent_original_case`: 色変更、反転、cropだけの派生ではないことを人が確認する。
- SHA-256: 同一画像は一件でも正式assemblyを停止する。
- Production-native profile: 実幅・実高さとprofileを一致させる。upscaleで揃えない。
- intended: 既存`panelSpecificationSchema`を使う。
- refs: referentialだけが中立名の参照画像を持つ。

権利台帳は`verified`、許諾根拠、benchmark利用許諾、確認者、ローカル権利証跡を必須とする。さらに、顧客、Production、モニター、成人向け、個人情報、v1、placeholder、単純変形の各項目がすべて`false`でなければschemaが拒否する。

API key、署名付きURL、内部Storage URLを台帳へ記載しない。CLIもURL、key、token、signatureに見える値を拒否する。画像PNGにPrompt、workflow、generation parameter等のtext metadata（`tEXt`、`zTXt`、`iTXt`）を残さない。

ただし、Providerが付与したC2PA Content Credentialsは生成元証跡であり、禁止text metadataとは区別する。原画像に`caBX` chunkがあるケースはprivate manifestの`required_provenance_chunks: ["caBX"]`で明示し、正規化、レビューZIP生成、正式assemblyの全工程でbyte-for-byteの画像コピーとchunk保持を検査する。Content Credentialsを除去・改変した派生物は正式候補へ使用せず隔離する。

## 4. 人手review

各画像を`reviewer_a`と`reviewer_b`が互いの回答を見ずに判定する。`reviewer_kind`は`human`だけを許可し、AI判定を正解ラベルへ昇格させない。

- verdict: `good / bad / borderline`
- bad: 7値／6大分類から1件以上のdefectが必要
- good: defectを持たない
- review担当: 異なる2名
- 不一致: 2名と異なる人間のadjudicatorが必須
- 完全一致なのにadjudicationを追加しない

正式assemblyは完全一致率90%以上、verdictのCohen's kappa 0.75以上を要求する。裁定後のlabelだけを`labels.private.json`へ出し、review途中の回答や権利台帳は出力しない。

## 5. splitと件数

| split | good | bad | borderline | total |
| --- | ---: | ---: | ---: | ---: |
| dev | 48 | 48 | 16 | 112 |
| private holdout | 12 | 12 | 4 | 28 |
| total | 60 | 60 | 20 | 140 |

combined badでは6大分類を各10件以上にする。各profileのgood／bad差は1以内にする。holdoutの画像、cases、labels、評価結果をPrompt、閾値、Provider選定、デバッグへ使わない。

## 6. 実行順

```powershell
npm run manga:quality:benchmark:assembly:audit
npm run manga:quality:benchmark:assembly:strict
npm run manga:quality:benchmark:assembly:write
npm run manga:quality:benchmark:strict
python -m pip install -r tests/fixtures/manga-quality/tools/requirements.txt
npm run manga:quality:benchmark:leak
```

`assembly:audit`は不足時に`BLOCKED_FIXTURE_SHORTAGE`を表示して終了コード0とする。`assembly:strict`と`assembly:write`は不足・契約違反時に非0で停止する。`assembly:write`は既存の`dev`または`holdout-private`を上書きしない。

出力後はv2.1 strict preflightでSHA、禁止PNG text metadata、必須Content Credentials、寸法、Panel Specification、件数、重複を検査し、Python checkerでbalanced accuracy、univariate AUC、dev／holdout shortcutを検査する。

## 7. rollback

assemblyの原本は変更しない。`dev`と`holdout-private`は派生出力である。誤った出力をrollbackする場合は、対象rootを再確認し、派生した2フォルダだけを退避または削除して台帳を修正し、再度auditから実行する。CLIは既存出力を上書きしないため、誤操作で正解ラベルや画像を置換しない。

## 8. 現在の停止条件

- 権利確認済み画像: 0/140
- 独立人手review: 0/280
- adjudication: 未実施
- strict fixture acceptance: `BLOCKED_FIXTURE_SHORTAGE`
- Visual Judge比較: 未開始

責任者が収集元、review担当、holdout管理者、外部送信範囲、検証予算を確認し、140件のstrict／leak gateが成功するまでPR-R4-3Bへ進まない。

Human Reviewerへ渡すZIP、Intrinsic／Referential分離、回答schema、validatorは`docs/quality-benchmark-human-review.md`を正本とする。
