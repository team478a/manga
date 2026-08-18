# RELEASE CANDIDATE: Benchmark Batch 01 匿名権利確認受入れ

## 対象

- Branch: `codex/docs-r4-3a-rights-review-acceptance`
- Base: `feature/manga-canvas-mvp` @ `47fe03d3ecbe90f1fd45f7708bc49423cc17fd57`
- 目的: private Batch 01の28画像について、人間の権利確認を匿名で完了し、staging取込み前のfail-closed検証を行う。

## Human確認

- 責任者が28画像の全権利確認項目を明示承認した。
- 確認者は実名を保存せず`anonymous`として記録した。
- 品質判定Reviewer A/BはログインプロフィールIDを内部識別にだけ使用し、氏名入力を要求しない。
- 権利確認とReviewer A/Bの品質判定は別工程として維持する。

## 完了package

- 元の権利確認ZIPは上書きせず保持した。
- 完了版はGit外private rootへ別名で作成した。
- package SHA-256: `05cf95e530d6ff699ade2a1237c882eb518281e15b9dcfb74f99a120f8a7ff59`
- `--require-complete`: 28/28成功
- Provider規約、Benchmark評価用途、顧客／Production素材不使用、個人情報なし、成人向けなし: 全件承認
- PNG、画像SHA-256、寸法、Content Credentials、exact duplicate: 成功
- 秘密値、実名、メール、画像、PromptはGitへ追加していない。

## staging dry-run

- Batch code: `batch_private_01`
- Cases: 28
- 結果: `STAGING_BATCH_ADMISSION_READY`
- rights completion: 成功
- image checksum／dimensions: 成功
- DB変更: なし
- Storage変更: なし
- Production変更: なし

## apply停止理由

現在の実行環境には以下のstaging専用設定がない。

- `MANGAI_MONITOR_REVIEW_STAGING_SUPABASE_URL`
- `MANGAI_MONITOR_REVIEW_STAGING_SERVICE_ROLE_KEY`
- `MANGAI_MONITOR_REVIEW_STAGING_PROJECT_REF`
- `MANGAI_MONITOR_REVIEW_PRODUCTION_PROJECT_REF`

一般のSupabase環境変数へfallbackせず、`--apply`を実行していない。

## ローカル検証

- 関連回帰: 4/4成功
- dependency／module boundary: 成功
- lint: 成功
- `git diff --check`: 成功
- module boundaryの既知warning 2件: 今回差分外

## 次工程

1. staging専用4設定と実在する管理者profile IDを安全なローカル環境へ設定する。
2. staging migration適用先、開始日時、終了日時を確認する。
3. 明示したstaging project refだけへapplyする。
4. 取込後も`draft`のまま、DB 28件、private bucket、SHA-256を確認する。
5. 確認後にだけactive化し、異なるモニターをReviewer A/Bへ割り当てる。
6. A/B回答とadjudication完了前に正式Benchmarkへ加算せず、R4-3Bへ進まない。

## 現在の件数

- Human権利確認: 28/28
- モニターA/B: 0/56
- 正式Benchmark: 0/140
- staging／Production取込: 0件
