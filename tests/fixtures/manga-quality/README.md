# Manga quality benchmark fixtures v2.1

R4-3A の Candidate Visual Benchmark 契約です。Page/Canvas完成度の評価とは分離します。画像、非公開ラベル、holdoutはGitへコミットしません。Production DB、Storage、既存作品からも取得しません。

## Package layout

```text
v2.1/dev/
  manifest.json
  cases.json
  labels.private.json       # evaluator only
  images/img_0001.png
  refs/
  intended/img_0001.json
v2.1/holdout-private/       # evaluator only; threshold調整担当へ渡さない
  ...same layout...
```

`cases.json` はVisual Judgeへ渡せる公開入力だけを持ち、verdict、defects、severity、review情報を含めません。`labels.private.json` は必ず別ファイル・別配布経路で管理します。ファイル名は `images/img_0001.png` のようにlabel-neutralにします。

## Exact composition

| split | good | bad | borderline | total |
| --- | ---: | ---: | ---: | ---: |
| dev | 48 | 48 | 16 | 112 |
| private holdout | 12 | 12 | 4 | 28 |
| combined | 60 | 60 | 20 | 140 |

bad 60件では、6つの大分類を各10件以上含めます。同じProduction-native image profile内のgood/bad差は1件以内です。各ラベルは独立した2名以上が確認し、不一致はadjudicationします。

## Acceptance

1. `npm run manga:quality:benchmark:preflight` — ファイル分離、ID、SHA-256、PNG metadata、Production profile寸法、Panel Specification、参照ファイル、件数・重複を検査。
2. `python -m pip install -r tests/fixtures/manga-quality/tools/requirements.txt`
3. `npm run manga:quality:benchmark:leak` — univariate AUC、dev CV、private holdoutのshortcutを検査。
4. evaluatorが人手レビューの合意率90%以上（推奨 Cohen's kappa 0.75以上）を確認。

最終Acceptanceはunivariate AUCが各0.65未満、dev CVとholdoutのbalanced accuracyが各60%以下です。sharpness/filesizeの群間差20%超は警告として人手確認します。不足をダミー画像や`unknown`で埋めません。

## Current evidence

- `evidence/v1_leak_result_v2_1.json` は旧33画像をnegative controlとして検査した結果で、期待どおりFAILです。
- 旧v1実画像は添付物に含まれないため、このリポジトリでは再現不能です。
- v2.1の140画像とprivate labelsは未提供のため、strict preflightは `BLOCKED_FIXTURE_SHORTAGE` が正しい状態です。
