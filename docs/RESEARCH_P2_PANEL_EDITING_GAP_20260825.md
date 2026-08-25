# P2 漫画設計データ・コマ単位編集 gap監査

## 1. 結論

P2は編集Canvasの新規構築ではない。Cloud／Desktopにはコマ、画像レイヤー、吹き出し、文字、テンプレート、変形、Undo／Redo、書き出しがあり、Cloudには1コマ再生成、inpainting／outpainting、候補採否、前後比較もある。最優先gapは、コマの意味情報を生成Jobや採用Storyboardから独立した編集可能な正本として保存できないこと、再読込後に編集履歴を戻せないことである。

## 2. 現行データ

|領域|現行正本|状態|
|---|---|---|
|ページ描画|`PageCanvas schemaVersion: 1`|コマ、panel layer、吹き出し、文字を保持|
|コマ画像|`Panel`／`PanelLayer`|Asset、fit、offset、scale、rotation、opacity、blend、source Jobを保持|
|吹き出し・文字|`Balloon`／`TextObject`|独立配列。親子、縦横、font、配置を保持|
|生成意図|採用Storyboard、`cloud_manga_panel_specifications`、Job input|複数箇所に分散。Job時点snapshotで編集正本ではない|
|人物・世界設定|versioned profile、panel assignment、continuity state|生成準備へ解決されるが、行動・カメラ等をまとめたpanel設計ではない|
|変更履歴|Cloud Canvas revision snapshot、client Undo／Redo、generation Job／採否|永続snapshotはあるが、利用者向けの操作単位差し戻し履歴ではない|

## 3. 要求との対応

|要求|現状|判断|
|---|---|---|
|コマ追加・削除|Cloud／Desktop実装済み|維持|
|並び替え|描画順とlayer順は実装。物語上の読み順は暗黙|意味上の`orderIndex`を追加|
|テンプレート／枠リサイズ|実装済み|維持|
|画像移動・拡大・crop|fit／offset／scale／rotation実装済み|維持|
|吹き出し・文字独立レイヤー|実装済み|維持|
|font・縦書き・位置変更|実装済み|維持|
|1コマ再生成|実装済み|維持|
|範囲指定修正|inpainting実装済み。Feature／Provider条件あり|既存経路を維持|
|表情・ポーズ・背景だけ修正|presetは存在。意味データとの照合なし|panel設計と結合|
|修正前後比較|生成Asset比較あり|候補／採用履歴へ一般化|
|元に戻す|session内Undo／Redoあり|永続操作履歴がgap|
|セリフ修正で画像再生成なし|構造的に可能|回帰fixtureを追加|
|保存再読込一致|Canvas snapshotで実装|意味データと履歴を追加検証|

## 4. 追加するコマ設計正本

既存`PageCanvas`へ意味情報を混在させず、project／page／panelを指す追加entityへ隔離する。最低限、次をversion付きJSONまたは正規化列として保持する。

- 場所、時間帯、天候
- 登場人物とcharacter version
- 行動、表情、ポーズ、視線、立ち位置
- カメラ距離、角度、レンズ相当、構図
- 小物、持ち手、左右関係
- セリフ、モノローグ、ナレーションへの参照
- 前コマから継続する状態
- prompt／negative条件への参照（利用者画面やlogへ秘密値を露出しない）
- 採用Asset、候補Job、修正元Asset、変更理由

既存Storyboardは初期materialization元、Job inputは生成時snapshot、Canvasは描画正本とし、いずれも削除・置換しない。

## 5. 実装PR分割

1. P2-A: `cloud_panel_designs`追加。owner RLS、revision、project／page／現行Canvas panel整合、rollback、既存データ非破壊。Provider変更なし。
2. P2-B: Storyboard／既存assignment／continuity stateからの明示materializationと、コマ設計Inspector。自動推測backfillはしない。
3. P2-C: prompt compilerがコマ設計versionを単一／batch生成入力へ固定。既存Prompt経路はFeature Flagで維持。
4. P2-D: 採用Asset／候補／部分修正のrevision chainと、再読込後も利用できる差し戻し。自動削除なし。
5. P2-E: 10コマfixtureでセリフだけの修正、1コマだけの画像修正、保存再読込一致を受入れ。

## 6. 受入条件

- セリフ本文だけを変更しても画像Jobとcreditが増えない。
- 1コマの設計・画像修正で他コマのCanvas、設計version、採用Assetが変わらない。
- 保存・再読込後もpanel order、layer、font、位置、採用Asset、コマ設計versionが一致する。
- 生成結果から使用したpanel設計versionと修正元Assetを追跡できる。
- 差し戻しで元Assetを失わず、自動判定だけで利用者データを削除しない。

## 7. 禁止・境界

- 既存Canvas schema、Storyboard、生成Jobを削除・置換しない。
- 1ページ一括画像を中心経路にしない。
- 特定Provider／model／ComfyUI nodeをpanel設計へ保存しない。
- Promptや画像、signed URL、秘密情報をlogへ出さない。
- Production修復、Provider実行、credit予約・消費を行わない。
- 外部Provider比較は責任者の明示承認後だけ行う。
