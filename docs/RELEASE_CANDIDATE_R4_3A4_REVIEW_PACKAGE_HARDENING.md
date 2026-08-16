# RELEASE CANDIDATE R4-3A4: Reviewer Package Context / Schema Hardening

作成日: 2026-08-17

Branch: `codex/fix-r4-3a4-review-package-context-schema`

Base: `origin/feature/manga-canvas-mvp` @ `61fcaf3`

Draft PR: [#294](https://github.com/team478a/manga/pull/294)

## 判定

`IMPLEMENTED_LOCAL / PILOT_PACKAGE_STRUCTURE_READY / PILOT_INTRINSIC_ONLY / NOT_COUNTED_IN_FORMAL_BENCHMARK`

R4-3A-4のコードと12件Pilot packageは実装・検証済み。正式Benchmarkは画像0/140、独立Human review 0/280のため未成立であり、R4-3Bへ進めない。

## 監査した既存契約

- PR #291: `ok / unknown / not_evaluated` Evidence、provider-neutral Visual Judge境界
- PR #292: Benchmark v2.1、public cases／private labels、dev 112／holdout 28、正式ケースID`img_0001`
- PR #293: private assembly root、rights／review、family split、strict／leak preflight
- `panelSpecificationSchema`: Panel／Character Identity／composition／background／props／action／cameraのsource of truth
- `qualityBenchmarkIntendedSchema`: 正式fixtureのPanel Specification／reference binding
- runtime failure enum: Human Review詳細categoryと意味が異なるため変更しない
- 既存Reviewer package: 中立名・blind性・画像profileは良好だが、mode、Panel Specification、reference、response schema、source group伝播が不足

## 実装

- `intrinsic_only`／`referential`とmode別選択category
- `mangai-human-review-v2` response schema
- verdict、confidence 1〜5、minor／major／critical、normalized bbox
- Humanと`ai_audit`の物理・schema分離
- existing Panel Specificationの再利用とProduction UUIDの中立化
- Character Identity reference binding
- source group／family／character／reference groupのprivate sidecar
- 同一source familyのdev／holdout分割拒否
- Reviewer A/B独立ZIP、no-overwrite、ランダム順序
- package／response validator、A/B agreement／disagreement report
- runtime enumを変更しない明示的Benchmark mapping

## Pilot証跡

| package | cases | 状態 | bytes | SHA-256 |
| --- | ---: | --- | ---: | --- |
| Reviewer A | 12 | PILOT_INTRINSIC_ONLY | 12,772,660 | `37A49366223C7582F73BD559C25D9466329E591EA55EC5DCBA4977482C622A64` |
| Reviewer B | 12 | PILOT_INTRINSIC_ONLY | 12,772,665 | `1D908A5FC4EA92AB6ABE01452B800B1602A04971A688A8A2C75FAB4E2F2821BC` |

両ZIPは既存ファイルを上書きせずローカルprivate rootへ生成した。正解label、expected severity、Reviewer A結果、AI結果、Prompt、split、URL、credentialは含めていない。package checksumとsource metadata sidecarが一致し、正式eligibleはfalse。Human回答はCodexが入力していない。

## 検証

- R4-3A-3／R4-3A-4集中: 20/20 PASS
- Reviewer A Pilot package validator: PASS
- Reviewer B Pilot package validator: PASS
- package内private label leakage: 0
- Reviewer A result leakage: 0
- Hub tests: 776/776 PASS
- Canvas tests: 26/26 PASS
- AI tests: 48/48 PASS
- dependency／module boundary: PASS（既存warning 2件、新規error 0）
- lint: PASS
- Hub typecheck: PASS
- Supabase migration／rollback: 59/59 PASS
- research eval: PASS
- Cloud漫画repository／owner isolation: PASS
- workspace packages build: PASS
- Hub production build: Webpack PASS
- RC preflight: STRUCTURE READY
- git diff --check: PASS
- 通常Turbopack: `LOCAL_BLOCKED_KNOWN_WINDOWS_PATH_LENGTH`
- Desktop typecheck／test／a11y／build: `LOCAL_BLOCKED_EXISTING_KEYRING_TYPE_DECLARATION`。今回差分外で、GitHub Windows buildを正式判定先とする。
- Production変更: なし

CI／Vercel PreviewはDraft PR作成後に追記する。

## 正式Benchmark採用条件

1. review mode整合
2. 既存Panel Specificationのintendedあり
3. 必要なreferenceあり
4. Human Reviewer A完了
5. Human Reviewer B完了
6. disagreement裁定済み
7. private labels更新済み
8. source group確認済み
9. duplicate check PASS
10. leakage check PASS

現在の12件は上記を満たさず、正式140件へ加算しない。

## 不変条件

Production、DB、migration、RPC、RLS、Storage、Provider、model、pricing、credit、Scheduler、runtime Visual Judge、runtime Panel Judge、repair engine、Canvas、checkpoint、PNG／PDF、公開販売、成人向け境界、Desktopを変更していない。外部Providerを呼び出していない。

## rollback

コードは本PRをrevertする。Pilot派生物はprivate rootの新規R4-3A-4 ZIPと同名sidecarだけを退避し、元画像と旧ZIPを維持する。Production側のrollbackは不要。

## 停止条件

Draft PR、全テスト、CI、Reviewer Package Validator、Response Validator、修正版Pilot packageが揃った時点で停止する。正式Human Reviewを実行せず、責任者確認前にR4-3Bへ進まない。
