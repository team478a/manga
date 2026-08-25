# P1-E 生成追跡情報 Release Candidate

## 結論

漫画コマの単一生成とbatch生成へ共通workflow versionを固定し、生成履歴から人物version、承認済み参照、画風・場所・小物version、連続状態、Provider、model、seedを追跡できる型付き情報へ集約した。Promptや秘密情報は公開しない。

## 基準

- Base: PR #347 merge commit `94a4853bbb06b2f21e9195fec363e2ab33623e07`
- Branch: `codex/p1e-generation-provenance`
- Migration: なし（既存Job inputを利用）

## 実装

- `storyboard-panel-v1`を単一／batch共通の漫画コマ生成入力へ固定する。
- Jobの非公開inputを既存schemaで再検証し、人物version、reference bundle／resolver、参照Assetとrole、画風・世界version、連続状態件数を抽出する。
- Provider、model、seed、workflow versionを同じ追跡オブジェクトへ集約する。
- Canvasの生成履歴へ折りたたみ表示を追加し、Prompt、negative prompt、画像、signed URLは表示しない。
- 従来Jobや不正な旧inputは空の追跡値へfail closedし、履歴一覧を壊さない。

## 検証

- 集中テスト: 4/4
- Hub: 856項目／860 tests
- Canvas: 26/26
- AI Core: 48/48
- Desktop: 182/182
- Desktop a11y: violation 0
- migration: 69件の静的検査
- deps、lint、Hub／Desktop型検査、Hub／Desktop build、RC structure、`git diff --check`

## 運用境界

- Production変更なし、DB migrationなし
- Provider／Worker／Job実行なし
- Storage操作、credit予約・消費なし

## 次候補

merge後は外部Providerを呼ばず、固定10シーンfixtureと採点表で同一人物・衣装・reference bundleの追跡受入れを自動化する。Flux Kontext／StoryDiffusion比較は別途ライセンス・GPU・費用承認後だけ行う。
