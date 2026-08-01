# MANGA Revision Comparison v1

## 目的

コマ修正候補を採用する前に、修正前と生成候補を同じ表示領域で比較できるようにする。違いを確認せず採用する操作ミスを減らす。

## 利用手順

1. Image-to-Image、部分修正、画角拡張の候補生成を完了する。
2. 完了した候補の「修正前と比較」を押す。
3. 比較スライダーを左右へ動かし、修正前と生成候補を確認する。
4. 「この候補を採用」または「候補一覧へ戻る」を選ぶ。

## 実装

- Job一覧の非公開inputは引き続き除外し、比較に必要な`source_asset_id`と`outpainting_direction`だけを本人へ返す。
- 元画像と候補画像は既存の本人所有private Asset署名URLを利用する。
- Outpaintingは候補と元画像の寸法比、拡張方向から元画像の正確な位置を算出する。
- 通常修正とInpaintingは同一全面位置で重ねる。
- ネイティブrange inputを使い、キーボード・タッチ・マウスで操作できる。
- 比較画面から既存の非破壊採用処理を実行する。

## 安全性と境界

- RLSで取得できる本人の作品・Job・Assetだけが対象。
- Prompt、negative prompt、Provider内部情報、署名URLをJob APIへ追加公開しない。
- DB migration、Provider、料金、生成処理は変更しない。
- 一般向けCloudの表示機能のみ。成人向け、Desktop、Stripe、Marketplaceは変更しない。

## 受入れ確認

- Image-to-Image、Inpainting、Outpaintingの各候補で比較画面が開く。
- スライダー0%、50%、100%で表示が破綻しない。
- Outpaintingの左・右・上・下・全方向で元画像の位置が一致する。
- 比較画面から採用しても元画像layerが残る。
- 閉じた場合はCanvasと候補に変更がない。
- 390px、768px、1280pxで横overflowがない。

## ロールバック

この変更のUIと安全な公開フィールドを戻す。migrationと環境変数の変更はない。
