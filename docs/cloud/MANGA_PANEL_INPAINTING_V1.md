# MANGAI Cloud コマ部分修正（Inpainting）v1

更新日: 2026-08-01

## 1. 目的

一般向けCloud原稿編集で、採用済みコマ画像の必要な範囲だけを描き直す。
元画像は置き換えず、新しい修正候補を比較・採用し、採用結果を
`correction` layerとして追加する。

## 2. 利用者フロー

1. 原稿編集で画像が配置されたコマを選ぶ。
2. 「部分修正」を開く。
3. 白いブラシで変更したい範囲を塗る。消しゴムと全消去も利用できる。
4. 顔、手・指、表情、衣装、背景、仕上げから修正内容を選び、必要なら追加要望を書く。
5. 2〜4案を生成し、元画像と候補を比較する。
6. 採用すると元画像を残したまま修正レイヤーが追加される。

マスクは黒が保持範囲、白が修正範囲である。利用者には技術的なProvider設定を表示しない。

## 3. 実装境界

- 対象: 一般向けCloud、選択コマ内の表示中画像、PNGマスク
- Provider: Black Forest Labs `flux-pro-1.0-fill`
- Provider operation: `inpainting`
- 価格登録: 1生成3 application credits、原価上限50,000 micros（USD 0.05）
- 保存: 元画像とマスクはprivate Storage、署名URLはWorker内で短時間だけ生成
- 非対象: 成人向けCloud、Desktop、Outpainting、Stripe、Marketplace

## 4. セキュリティと失敗時の動作

- `CLOUD_PANEL_INPAINTING_ENABLED=true` の場合だけ機能を公開する。
- Flagが未設定またはfalseなら、DB参照やProvider呼び出し前に停止する。
- 修正元は選択コマに実際に表示されている、同一作品・同一所有者の非削除Assetに限定する。
- マスクも同一作品・同一所有者の非削除PNGに限定する。
- マスク寸法が修正元画像と一致しない場合はProvider呼び出し前に拒否する。
- private Storage URL、APIキー、内部DB／Providerエラーは利用者へ返さない。
- Fill非対応モデルへ暗黙fallbackせず、安全に失敗させる。
- Job公開情報には安全なoperationとpresetだけを含め、Promptやprivate入力を含めない。

## 5. Provider契約

現在のBFL OpenAPIにある `POST /v1/flux-pro-1.0-fill` を利用する。
入力画像とマスクをサーバー側で取得し、base64へ変換して送信する。
マスク省略による自動判定は使わず、MANGAIで作成した明示マスクを必須とする。

公式資料:

- OpenAPI: `https://api.bfl.ai/openapi.json`
- 料金: `https://docs.bfl.ai/quick_start/pricing`

## 6. DB migration

- Forward: `supabase/migrations/202608010002_cloud_panel_inpainting.sql`
- Rollback: `supabase/rollbacks/202608010002_cloud_panel_inpainting.sql`
- 追加内容: Fillモデルの価格行のみ。新しい利用者データテーブルは追加しない。

## 7. 有効化手順

1. 親PRのmigrationを含め、対象環境へmigrationを順番に適用する。
2. 管理画面で一般向けBFL APIキーが保存済み、有効、モデル利用可能であることを確認する。
3. `CLOUD_PANEL_INPAINTING_ENABLED=true` を対象Previewブランチだけに設定する。
4. Previewを再デプロイする。
5. 一般向けテスト作品で、マスク作成、候補生成、比較、採用、保存後再表示を確認する。
6. 費用・失敗率・不適切出力を確認してからProductionへ広げる。

## 8. 受入れ条件

- マウスとタッチでマスクを描ける。
- 画像外や別コマのAssetを修正元にできない。
- マスクなし、形式不正、寸法不一致を事前拒否する。
- 黒い範囲を保ち、白く塗った範囲を中心に候補が生成される。
- 候補を採用しても元画像が残り、Undo可能なレイヤーになる。
- 再読込後も採用した修正が表示される。
- Flag停止時はUIとサーバーの両方で利用できない。

## 9. Rollback

緊急停止はまず `CLOUD_PANEL_INPAINTING_ENABLED=false` にして再デプロイする。
既存の採用済みcorrection layerは削除しない。価格設定も戻す必要がある場合だけ
rollback SQLを適用する。

## 10. 次工程

- M3-3: Outpainting（キャンバス外拡張）
- 修正前後スライダー
- 顔・手などの自動マスク候補
- 実Providerでの品質・費用・マスク境界評価
