# P1-F 固定10シーン追跡fixture Release Candidate

## 結論

外部Providerを使わず、固定10シーンで同一人物version、衣装version、承認済み参照role、reference bundle／resolver、Provider／model／workflowを決定論的に採点する受入fixtureを追加した。画像を生成していないため、顔・髪・衣装・体格・配色・構図の視覚品質は`NOT_EVALUATED`として扱う。

## 基準

- Base: PR #348 merge commit `d11ea3db03859e78755665423394bcb367926d16`
- Branch: `codex/p1f-ten-scene-provenance-fixture`
- Migration／製品UI／Provider変更: なし

## 採点表

- 自動評価: 固定10シーン数、人物version、衣装version、必須参照role、Provider／model／workflow、reference bundle／resolver
- 視覚評価欄: 顔、髪、衣装の視覚一致、体格、配色、構図追従
- 判定: `PASS / FAIL / NOT_EVALUATED`
- 参照付きfixtureは自動評価6項目をPASSする。
- 参照なしfixtureは`reference_coverage`と`bundle_trace`をFAILする。
- 1シーンへ人物／衣装driftを混入すると該当2項目だけをFAILする。

## 検証

- 集中テスト: 5/5
- Hub: 859項目／863 tests
- Canvas: 26/26
- AI Core: 48/48
- Desktop: 182/182
- Desktop a11y: violation 0
- migration: 69件の静的検査
- deps、lint、全型検査、Hub／Desktop build、RC structure、`git diff --check`

## 運用境界と残件

- Production、Provider、Worker、Job、Storage、credit操作0件
- 実画像の顔・髪・衣装・体格・配色・構図評価は未実施
- Flux Kontext／StoryDiffusion等の比較は、ライセンス、モデル条件、GPU、費用、Provider実行の責任者承認後だけ開始する
