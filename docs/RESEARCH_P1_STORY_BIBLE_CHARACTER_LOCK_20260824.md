# P1 作品バイブル・キャラクター固定 現行gap監査

## 1. 結論

P1は新規構築ではなく、既存のversioned profileと生成入力固定を拡張する。現行は人物、画風、場所、小物、参照Asset、コマ割当、生成Job追跡まで実装済みである。最優先gapは参照画像と人物versionの結合、参照画像の役割、衣装・状態の適用範囲、参照不足時のfail-closed方針である。

## 2. 現行実装

|領域|正本|現状|
|---|---|---|
|人物|`cloud_character_profiles` / `_versions`|名前、役割、年齢感、体格、髪、衣装、配色、禁止変更、prompt、negative promptを追記version化|
|画風|`cloud_style_bibles` / `_versions`|画風、線、陰影、背景密度、構図規則、negative promptをversion化|
|場所・小物|`cloud_world_profiles` / `_versions`|説明、視覚特徴、配色、連続性規則、promptをversion化|
|参照画像|`cloud_visual_reference_assets`|人物・画風・場所・小物へowner Assetを関連付け|
|コマ割当|`cloud_panel_subject_assignments`|page／panelへ人物・場所・小物を明示割当|
|生成入力|`cloudGenerationInputSchema`|`characterProfileVersions`、`styleBibleVersion`、`worldProfileVersions`、最大8参照Asset、seedを保持|
|長編batch|`cloud_generation_batch_targets`|moderation済み入力、prompt digest、Panel Specification、page revisionをJobより先に永続化|
|参照送信|`process-generation.ts`|project owner Assetを再検証し、短命signed URLだけをProvider contextへ渡す|
|準備検査|`generation-batch-preflight.ts`|Style Bibleと登場人物名に対応する人物設定の存在を必須化|

## 3. gap

### P1-G1 versionと参照画像

- 参照画像は`subject_id`へ紐づき、人物・場所・小物の`version_number`を保持しない。
- profile更新後も旧衣装の画像が現行version候補として選ばれ得る。
- Job入力にはversionとAsset IDが別々に残るが、その組合せが正当だったことをDB制約で証明できない。

### P1-G2 参照画像の役割

- `label`は自由文で、front／side／back／face／full-body／expression等を機械判定できない。
- 現行選択は人物ごと最大2枚で、役割、優先度、品質確認状態を考慮しない。
- 同一Assetの重複は防ぐが、主要人物に必要な役割が揃ったか判定できない。

### P1-G3 人物・衣装・状態

- 年齢感、体格、髪、衣装、配色、禁止変更はあるが、身長、肌、目、アクセサリー、利き手を独立項目として追跡しない。
- 衣装が人物version内の単一文字列で、章／ページ範囲、場面、変更理由を持たない。
- 成長後・変装・負傷などを新versionにできるが、どのページ範囲で使うかの割当がない。
- scenario由来Character SheetとVisual Character Profileは別系統で、一意な対応関係を保持しない。

### P1-G4 場所・小物の連続状態

- 場所／小物versionはあるが、時間帯、天候、状態、持ち手、左右、所有者、前コマからの継続を構造化していない。
- 名前の本文一致による自動解決は同名・表記揺れに弱く、明示割当がないコマでは誤選択余地がある。

### P1-G5 readinessと停止方針

- preflightは人物プロフィールとStyle Bibleの存在を検査するが、主要人物の参照画像を必須化しない。
- 「警告して続行」「生成を停止」の作品別方針がない。
- 単一コマ生成とbatchで同一readiness判定を共有する明示契約がない。

### P1-G6 provenance

- Job入力から人物／画風／世界versionと参照Asset、provider／modelを追跡できる。
- 一方、`workflow_version`とJob列`seed`への正規化、参照bundle version、resolver versionは全経路で固定されていない。

## 4. 推奨データ設計

既存tableを削除せず追加する。

1. `cloud_character_reference_bindings`
   - character profile version ID、Asset ID、role、expression key、priority、review status。
   - role: `front / side / back / face / full_body / expression / costume_detail`。
2. `cloud_character_state_assignments`
   - project、profile version、開始／終了page、任意scene key、衣装・状態label。
   - 範囲重複は明示優先度またはDB拒否のどちらかを設計時に固定する。
3. `cloud_panel_continuity_states`
   - panel、subject、time／weather／state／hand／side／gaze等の構造化値。
4. `cloud_project_generation_readiness_policies`
   - major character reference不足時の`warn / block`。既定は`block`を推奨。
5. 生成入力へ`referenceBundleVersion`と`resolverVersion`を追加し、Job作成時の解決結果を不変化する。

## 5. 実装PR分割

1. P1-A: version付きreference binding schema、role enum、RLS、rollback、既存参照の非破壊backfill方針。Provider変更なし。
2. P1-B: 単一のreference resolverとreadiness policy。単一コマ／batchで共有し、解決結果を生成入力へ固定。
3. P1-C: 人物version・参照role・衣装適用範囲UI。既存自由文設定を維持。
4. P1-D: 場所・小物・左右・時間状態と前コマ継続の構造化。
5. P1-E: 10シーンfixtureと採点表。現行方式と参照付き現行方式をmock／fixtureで先に比較。
6. P1-F: 外部Provider／Flux Kontext／StoryDiffusion比較はライセンス、モデル条件、GPU、費用の別承認後だけ実行。

## 6. 受入計画

- 同一人物・同一衣装10コマで、全Jobが同じ人物versionと承認済みreference bundleを追跡できる。
- profile更新後も既存Jobのversion／Asset組合せが変わらない。
- front等の必須参照不足時、作品方針`block`ならJob・credit予約前に停止する。
- `warn`時は警告理由を保存し、ユーザーが明示続行した事実を追跡する。
- 1コマの人物・衣装変更が他ページの既存割当を変更しない。
- owner外Asset、削除Asset、別version Assetをresolverが拒否する。
- Prompt、signed URL、画像、秘密情報をlogへ保存しない。

## 7. 非対象・禁止

- 今回は調査文書のみ。migration、API、UI、Provider interface、生成Promptを変更しない。
- OSSコード／workflow／modelを導入しない。
- Production、Provider、Worker、Job、Storage、credit予約・消費を実行しない。
- P1-Aは本調査PRのレビュー・merge後に開始する。
