# Cloud原稿編集 動画マニュアル（2026-10-08）

## 目的

初めて利用する購入者が、情報量の多い原稿編集画面で次に行う操作を判断できるようにする。特に問い合わせのあった「原稿編集以降」を、実画面に近い匿名化済み画面で短く案内する。

## 利用者向け内容

- 約1分13秒、1280×720、音声なし、日本語字幕付きのMP4
- 作品画面の確認から完成版固定、PDF書き出しまでを8章で案内
- 各章へ直接移動できるボタン
- ブラウザ標準の再生・停止・シーク・字幕操作
- 通信が不安定な場合に備えた動画ダウンロード
- 動画を再生できない場合の文字版手順
- 「使い方」画面、作品一覧、作品画面から動画へ移動できる導線

## 8章

1. 作品画面で現在地を確認
2. 人物・衣装と画風を固定
3. 参照画像をコマへ割り当て
4. 最初は連続2ページだけ選択
5. 必要creditと停止理由を確認
6. 生成候補を比較して採用
7. 吹き出しと文字を調整
8. 全ページを確定してPDF保存

## 配信ファイル

- `public/manual/cloud/cloud-creator-operation-guide.mp4`
- `public/manual/cloud/cloud-creator-operation-guide-poster.webp`
- `public/manual/cloud/cloud-creator-operation-guide.vtt`

動画の再生成は、ffmpeg実行ファイルを`MANGAI_FFMPEG_PATH`へ指定して`npm run manual:cloud:video`を実行する。生成元はrepository内の匿名化済みSVGだけで、Productionや外部サービスからデータを取得しない。

## プライバシーと変更範囲

- 利用者名、メール、作品、Prompt、APIキー、credit残数などの実データは動画へ含めない。
- Production、DB、migration、API、Provider、credit、商品、公開・販売状態は変更しない。
- 動画は音声なしのため、周囲で再生しやすく、字幕だけでも全手順を理解できる。

## 検証

- 動画: H.264 / 1280×720 / 15fps / 1分13秒、ブラウザ配信用faststart
- 集中テスト: 12/12成功
- Hub全テスト: 成功
- Hub型検査: 成功
- ESLint: 成功
- 依存境界: error 0（既知warning 2）
- Production build: 成功
- ポスターおよび動画の先頭・中盤・終端フレームを目視確認

