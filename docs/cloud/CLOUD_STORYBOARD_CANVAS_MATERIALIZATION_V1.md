# Cloud Storyboard Canvas Materialization v1

## 入力

- 所有者本人の最新採用`cloud_story_storyboard_versions`
- `openai-storyboard-v1`で検証済みの一般向けネーム

## 出力

- 非公開・一般向けCloud Project 1件
- Episode 1件
- ネームと同数のPage
- 各PageのCanvas schema v1 snapshot
- ネームのコマ数に対応するコマ枠
- セリフ等に対応する吹き出しと文字
- 元ネーム、Project、先頭Pageを結ぶ追跡record

## 変換規則

- Projectは1600×2400px、300dpi、右綴じ
- Pageはネームの`pageNumber`順
- コマは右上から右綴じの順に配置
- 1〜6コマを2列以下の均等グリッドへ配置
- `speech`は楕円、`thought`は角丸、`narration`はナレーション枠
- 画像Asset、Panel Layer、生成Jobは作らない
- 構図・背景・動作等の詳細は元ネームを正本として保持する

## 冪等性

`storyboard_version_id`に一意制約を持たせ、transaction advisory lock内で既存変換を再確認する。
再実行時は新規Projectを作らず、既存Projectと先頭Pageを返す。

## 安全境界

- `CLOUD_STORYBOARD_CANVAS_ENABLED=true`の場合だけServer Actionを実行
- 最新の採用ネーム以外をDB functionで拒否
- 一般向け市場分析に連なるネームだけを許可
- 所有者は`current_profile_id()`から決定し、Client入力を信用しない
- 画像生成、外部AI、Storage、課金処理を呼び出さない
- DB内部エラーを利用者へ表示しない

## C3 Cloud文字内包（2026-10-12）

- `dialogue-region.ts`の保守的内接矩形を自動配置、明示修復、完成チェックで共有する。楕円はstrokeを含むinset後の軸長を`1/√2`へ縮め、角丸はSVGの30px半径を考慮する。尻尾を文字領域へ含めない。
- `translate(x,y) rotate(rotation)`の左上基点で文字枠の4隅を親領域へ逆変換し、枠全体と本文／ルビのem-cell・行領域を検査する。これは任意fontの実outline測定ではない。最終描画の目視確認は別の受入れ条件。
- 18px未満や字面／ルビが収まらない場合は修復成功にせず、完成blockerを残す。最小文字でも長文が入らないときは吹き出し拡張・文面編集が必要。
- Cloud文字previewはexportと同じescaped SVG文字layoutを使う。ルビ記法を生表示せず、句読点・長音・縦中横等の既存layoutを保持する。文字をoverflow clippingで隠して成功扱いにしない。画面opacityは親要素だけで適用する。
- 吹き出しの位置・寸法・回転・形状変更は関連文字と同じCanvas履歴／autosave snapshotへ記録する。回転差を追従し、内包が崩れた対象吹き出しだけをfitする。関連文字lock時は幾何変更を拒否し、lock解除や外観編集は妨げない。
- dragは吹き出し本体と関連文字の回転後4隅をページ内へ制限する。数値変更でページ外へ出た文字やネームにない追加の関連文字も完成不可になる。
- 保存形式schema v1、API、DB、IPCは変更しない。既存原稿の読込時や既存Jobでの一致本文を自動書換えしない。利用者が明示修復を選ぶ。
- **残件**: DB `build_cloud_storyboard_canvas`の新規下書き作成は旧矩形配置のまま。新規下書きへの内接領域適用は追加migrationとroundtrip検証を別PRで扱う（既存migration／原稿は変更しない）。Desktop編集追従、実ブラウザと日本語PNG/PDF目視、4ページ16コマ実画像品質も未受入れ。
