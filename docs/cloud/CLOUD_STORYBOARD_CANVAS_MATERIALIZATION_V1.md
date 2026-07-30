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
