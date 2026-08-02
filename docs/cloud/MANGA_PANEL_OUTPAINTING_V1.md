# MANGA Panel Outpainting v1

## 目的

採用済みの一般向けコマ画像を作り直さず、左・右・上・下・全方向へ画角を広げる。元画像は残し、生成候補を採用した場合だけ correction layer を追加する。

## 利用手順

1. 原稿編集で画像が配置されたコマを選ぶ。
2. 「画角を広げる方向」で左側、右側、上側、下側、全方向のいずれかを選ぶ。
3. 必要なら延長したい背景の要望を入力し、2〜4案を生成する。
4. 候補を比較し、採用する画像だけをコマへ追加する。

## 実装

- operation: `outpainting`
- Provider: Black Forest Labs `flux-pro-1.0-fill`
- 単一方向は元画像寸法の25%、全方向は各辺12.5%を目安に拡張する。
- Workerがprivate署名URLから元画像を取得し、Sharpで白い余白を追加する。
- 元画像領域を黒、追加余白を白にした同寸法マスクを生成し、BFL Fillへ送る。
- 出力寸法は各辺2048px以下、入力・生成物は25MB以下に制限する。
- 既存のFill価格行 `bfl-flux1-fill-2026-08` を再利用するため、新規migrationはない。

## 安全性

- `CLOUD_PANEL_OUTPAINTING_ENABLED=true` のときだけ利用でき、未設定時は認証・DBアクセス前にfail closedする。
- 修正元は、本人所有の一般向け作品で選択コマに表示中のAssetだけを許可する。
- 元画像の署名URL、Prompt、Provider内部エラーは利用者へ返さない。
- マスクはWorker内で生成し、外部URLのリダイレクトと過大ファイルを拒否する。
- 成人向け、Desktop、Stripe、Marketplaceは変更しない。

## 公開前確認

- Previewブランチへ `CLOUD_PANEL_OUTPAINTING_ENABLED=true` を限定設定する。
- 左・右・上・下・全方向を実画像で各1回確認する。
- 元画像が残ること、候補採用後に再読込しても correction layer が復元されることを確認する。
- 390px、768px、1280pxで横overflowと操作不能がないことを確認する。
- BFL使用量と予約creditがFill価格設定内であることを確認する。

## ロールバック

`CLOUD_PANEL_OUTPAINTING_ENABLED` を削除または `false` にしてRedeployする。DB変更はない。
