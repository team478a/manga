# 2ページPilot停止条件の原因監査

日付: 2026-08-24

## 結論

Productionの2ページPilotが開始不能なのは正常なfail-closed動作である。利用者画面だけで安全に解消できる状態ではなく、管理者によるモニター登録確認と、scenario／storyboard由来情報を持たない既存作品のVisual Readiness契約判断が先に必要である。

## Production read-only証跡

- 画風・世界観設定: 画風、線、陰影、背景密度、構図の5項目が未入力。保存済み場所・小物0件。
- キャラクター設定: 保存済みキャラクター0名。
- 作品画面: 「この作品にはシナリオ由来のキャラクター設定がありません」と表示。
- モニター画面: 「モニター利用設定を確認できません」と表示。
- ダッシュボード: 「モニター利用設定を確認」と表示。
- 各画面のconsole errorは0件。

## コード上の原因境界

### Visual Readiness

`getCloudGenerationBatchPreflight`は`cloud_story_storyboard_projects`、人物profile、Style Bibleを読み込む。対象作品にstoryboard materializationが無い場合、人物・画風の入力有無を評価する前に`visualReadinessAvailable=false`となる。

したがって、対象作品で画風と人物を手入力するだけではPilot blockerが解消しない可能性がある。既存作品へ正しいscenario／storyboard versionを関連付けるか、手動制作作品向けの別のVisual Readiness契約を設計する必要がある。推測で関連付けたりguardを緩和してはならない。

### モニター枠

`getCloudGeneralMonitorEnrollment`は次の状態をすべて`null`へ変換する。

- Monitor Beta Feature Flagが無効
- profileに対応するenrollment rowが無い
- Supabase Admin credential／DB取得エラー

利用者画面だけでは原因を一意に決められない。管理者権限でFeature Flag、対象profile、enrollment、開始／終了日時、status、limit／usedをread-only確認する必要がある。

## 次工程

1. 管理者によるモニター設定のread-only確認。
2. 対象作品のstoryboard materialization有無と、正本scenario／storyboard versionのread-only確認。
3. 既存作品へ正本を関連付けるか、手動制作作品用preflightを設けるかを責任者が決定。
4. 決定後、設定変更／migration／データ修復を別の明示承認作業として実施。
5. 画風・人物、monitor、credit、対象ページ、最大creditが揃ってからのみPilotを開始。

## 不変

Productionの設定、DB、Storage、作品、Canvas、Provider、Worker、Job、creditを変更していない。フォーム入力、保存、生成、管理操作は0件。
