# MANGAI Cloud Character Identity v1

作成日: 2026-08-09

## 目的

一般向けCloud漫画で、同じ人物の髪、年齢印象、体格、衣装、固有特徴をコマ間で比較できる内部契約を定義する。Character Identityは新しい利用者設定やDBではなく、既存の版管理済みCharacter Profileとprivate参照画像から生成Job開始時に作るスナップショットである。

## 保存と参照の境界

- 編集正本: `cloud_character_profiles`と`cloud_character_profile_versions`
- 画像正本: private `cloud_assets`を参照する`cloud_visual_reference_assets`
- 生成時スナップショット: `cloud_manga_panel_specifications.specification.characterIdentities`
- 画像URLは保存せず、所有者境界内のasset UUIDだけを保持する
- 現行参照画像には表情／全身の用途分類がないため、推測せず`identityReferenceImages`へ格納する
- 既存Profileにない目色、肌色、身長区分、顔要約、別衣装は空欄のまま保持する

`lockedAttributes`は値が存在する既存項目だけを初期固定する。現行Profileでは見た目年齢、体格、髪、基本衣装、変えてはいけない特徴が対象となる。将来のUIで値と固定指定を追加できるが、本版ではDB・RPC・URL・API・Canvas schemaを変更しない。

## Judgeの扱い

JudgeはIdentityに含まれる固定属性だけを評価対象とする。意味解析の証拠がない属性は減点せず中立75点とし、観測された不一致だけを人物一致スコアへ反映する。髪・目・顔要約の不一致は`face_mismatch`、固定属性全般の不一致は`continuity_break`として内部記録する。

この版では新しい画像解析Providerを呼ばない。したがって通常の生成完了処理は従来と同じ中立評価で、Provider、model、pricing、retry、timeout、Scheduler、課金、候補表示、PDF／PNGへ影響しない。

## ロールバック

Q2コードを戻すと、既存のPanel Specificationは`characterIdentities`を無視して従来どおり評価できる。Q2以前のSpecificationはschema既定値`[]`で読めるため、データ移行や削除は不要である。Character Profileと参照画像は既存正本として残り、生成PromptとProvider入力も変更されない。
