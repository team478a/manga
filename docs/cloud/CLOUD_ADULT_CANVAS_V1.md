# Cloud成人向けCanvas v1

## 利用者フロー

1. 許可済み利用者が成人向けAIネームを採用する。
2. 「成人向けCanvas下書きを作成」を選ぶ。
3. 全ページのコマ枠、吹き出し、縦書き文字がCanvasへ配置される。
4. 作成済みCanvasを開き、通常の編集操作を行う。

この工程では画像生成、外部送信、課金は発生しない。成人向けAI画像生成は未提供であり、一般向け画像生成APIでも明示的に拒否される。

## 安全境界

- 環境Flag: `CLOUD_ADULT_CANVAS_ENABLED`
- 共通Canvas Flag: `CLOUD_STORYBOARD_CANVAS_ENABLED`
- 認可: 既存の成人向けAIネーム個別許可、本人同意、DB Kill Switch
- DB区分: `cloud_projects.content_class = 'adult'`
- 年齢表示: `18歳以上`
- 公開範囲: private固定。成人向けProjectの公開・共同編集はRLSで許可しない。
- 画像生成: 変換記録と元ネームが両方`general`でなければ一般向け画像生成APIが拒否する。

## DB

- forward: `supabase/migrations/202607300009_cloud_adult_canvas.sql`
- rollback: `supabase/rollbacks/202607300009_cloud_adult_canvas.sql`
- 既存成人向けCanvasがある場合、データ損失を避けるためrollbackは停止する。

## 公開前設定

`npm run cloud:adult-canvas:preflight`

この検査は設定名と設定有無だけを表示し、値は表示しない。migration適用、環境Flag有効化、Previewでの実操作は責任者が行う。
