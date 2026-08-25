# P3 自動品質検査・部分再生成 gap監査

## 1. 結論

P3は品質判定基盤の新規構築ではない。現行には生成Job単位の仕様・rule評価・採否ログ、Visual JudgeのEvidence契約とbenchmark、作品連続性レビュー、原稿preflight、コマ再生成・inpainting・Asset版履歴、品質KPI計算がある。

最優先gapは、これらがCreator向けの統一された品質所見として保存・表示されず、所見の対象領域と修正案が既存の部分修正経路へ接続されていないことである。既存評価を置換せず、追加のfinding正本で統合する。

## 2. 現行資産

|領域|現行実装|維持するもの|
|---|---|---|
|生成仕様|`cloud_manga_panel_specifications`、`PanelSpecification`|Job時点の人物数、表情、構図、背景、小物、動作、camera|
|rule評価|`evaluateCompletedPanelCandidate`、`cloud_manga_quality_evaluations`|Asset有無・寸法、score、failure category、候補順位|
|Visual Judge|`MangaVisualJudge`、`VisualEvidenceResult`、R4-3A benchmark|judge provenance、evidence status／score／confidence、coverage、critical failure|
|採否・費用|`cloud_manga_quality_logs`、`calculateMangaQualityMetrics`|採用率、retry／repair回数、Provider／model別採用率、費用|
|原稿rule|`analyzeCloudManuscript`|空コマ、Asset欠落、低解像度、文字切れ、不自然な縦書き|
|連続性|`evaluateCloudContinuity`|設定version／参照欠落、隣接画像完全一致、採用済みcontinuity evidence|
|修正|コマ再生成、revision preset、inpainting mask、Asset版履歴|利用者の明示操作、候補保持、差し戻し|

## 3. 要求との対応

|P3要求|現状|gap|
|---|---|---|
|PASS／WARNING／FAIL／NOT_EVALUATED|Evidenceには`ok／unknown／not_evaluated`、原稿検査にはerror／warning、評価にはdisplay bandがある|Creator向けの統一判定と変換規則がない|
|判定理由・対象領域・信頼度・修正案|Evidenceにreason／confidenceはある|永続finding、normalized region、修正案schemaがない|
|人物数・本人性・衣装・体格|仕様、人物identity、Visual Evidence項目はある|runtimeはAsset有無・寸法中心。Visual Judge adapterはbenchmark契約のみ|
|手指・顔・身体|failure categoryとEvidence項目はある|runtime evaluatorと対象領域がない|
|背景・小物・左右・視線・連続性|panel設計、continuity state／reviewはある|品質findingへの統合とコマ単位表示がない|
|セリフ・話者・読み順・文字切れ|文字切れ／縦書きruleはある|話者・表情・読み順・重なりの統一検査がない|
|同一構図の連続|完全一致Asset／digestだけを候補表示|構図特徴の過度な連続は未評価|
|問題コマだけ再生成|手動1コマ再生成・inpaintingはある|findingから安全な修正preset／maskへ接続されていない|
|元画像を失わない|候補、layer、Asset版履歴を保持|維持。自動FAILから削除・不採用しない|

## 4. 重要な技術gap

1. `evaluateCompletedPanelCandidate`は現在、完了時にAsset有無と期待／実寸法だけを渡す。未取得の人物・表情・背景・身体等はrule evaluator内で75へ補完されるため、未評価証跡として扱えない。
2. `cloud_manga_quality_evaluations`はJobごとの集約scoreとcategoryを保持するが、finding単位のstatus、region、confidence、suggestion、evaluator versionを正規化していない。
3. Creatorの生成履歴は`overall_score`を候補順位に使うが、failure category、理由、coverage、confidenceを取得・表示しない。
4. Visual Judge interfaceとbenchmarkは存在するが、Production runtime adapter／起動方針は接続されていない。画像を外部へ送る実装は明示承認まで行わない。
5. 原稿preflight、連続性review、quality evaluationが別レポートで、同じコマの所見として集約されない。
6. inpaintingのmask suggestionは画面上の固定presetであり、検出領域から生成されたものではない。

## 5. 追加するfinding契約

既存評価tableを変更・削除せず、project／page／panel／採用Assetまたはgeneration Jobへ結び付くappend-only findingとrunを追加する。

- status: `PASS | WARNING | FAIL | NOT_EVALUATED`
- category: 人物数、本人性、髪、衣装、体格、身体、背景、小物、左右、視線、セリフ、読み順、文字配置、構図重複等
- reason: 利用者向けの固定文言または安全に整形した説明
- region: 画像内0〜1のnormalized rectangle／polygon。特定不能ならnull
- confidence: 0〜1。ruleの確定判定は根拠付きで扱う
- suggestion: `review | edit_text | regenerate_panel | inpaint | update_design | update_reference`
- evaluator: rule／judge ID、version、data handling、入力snapshot version
- provenance: panel design revision、Asset ID、source Job ID、前後コマ参照

`NOT_EVALUATED`を数値の中立点へ変換しない。自動判定は採用Asset、Canvas layer、候補、Jobを削除せず、修正Jobも利用者の明示確認前には作成しない。

## 6. 実装PR分割

1. P3-A: inspection run／finding schema、owner RLS、append-only provenance、既存評価との互換read model、rollback。
2. P3-B: 原稿preflight、panel設計、continuity、生成追跡から決定論的rule findingsを作る。未評価項目は`NOT_EVALUATED`。
3. P3-C: Creator品質Inspector。status／理由／confidence／対象領域／修正案を表示し、問題コマだけ選択できる。自動削除なし。
4. P3-D: findingから既存の文字編集、1コマ再生成、revision preset、inpainting mask候補へ変換するrepair plan。実行は費用表示後の明示操作のみ。
5. P3-E: Visual Judge runtime adapterをFeature Flag・data handling・費用上限・benchmark合格条件の後ろへ隔離。明示承認まではmock／local契約検証だけ。
6. P3-F: 人数違い、衣装違い、文字切れを含む固定fixture、誤判定時の元画像保持、問題コマだけの修正、KPI回帰を受入検証。

## 7. 受入条件

- 未評価項目がPASSや75点として表示されない。
- 意図的な人物数違い、衣装version違い、文字切れを固定fixtureで検出できる。
- findingから対象コマと対象領域を追跡でき、問題コマだけを修正候補にできる。
- 自動FAIL、再評価、差し戻しのいずれでも元Assetと候補を失わない。
- Vision未設定・失敗時はrule findingsを保持し、Vision項目を`NOT_EVALUATED`にする。
- KPIは初回採用率、平均再生成回数、採用コマ費用、完成時間、人物重大不一致率、生成失敗率を作品別に集計できる。

## 8. 禁止・境界

- 既存`cloud_manga_quality_evaluations`、採否ログ、原稿preflight、continuity reviewを削除・置換しない。
- 自動判定だけで採用、不採用、Asset削除、Job作成、credit予約を行わない。
- 外部Vision Providerへ画像、Prompt、成人向け内容を明示承認なしに送らない。
- Provider固有model名やnodeをdomain／UIへ保存しない。
- Production修復、Provider実行、Storage変更、credit予約・消費を行わない。

## 9. 検証

- Hub 876/876、Canvas 26/26、AI 48/48、Desktop 182/182成功。
- a11y violation 0、migration 70件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- 既知の非差分事項はnpm audit 5件（moderate 1、高4）とmodule boundary warning 2件。RC外部設定／手動E2Eはpending。
