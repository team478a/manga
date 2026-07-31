# MANGAI Cloud Release 6 実装計画

## 目的

Release 5で作成したCanvas下書きのコマを選ぶだけで、ネームの構図・人物・背景・動作・感情を既存Cloud AI Queueへ安全に引き継ぐ。
利用者にPromptやProviderの知識を要求せず、生成後のAssetを対象コマへ配置できる縦型フローを作る。

## 今回の対象

1. Release 5由来Projectとネームの所有者照合
2. 選択コマと元ネームのページ・コマ対応解決
3. Server側の一般向け画像生成条件作成
4. 既存quota、moderation、Provider Registry、Queueへの登録
5. 生成Jobと対象コマのClient側関連付け
6. 完了Assetの対象コマ配置
7. Feature Flag、preflight、loading、error、empty状態
8. モックProviderを使う自動テスト

## 対象外

- 新しい画像Provider契約
- 本番Provider有効化、有料生成
- キャラクター参照画像
- ページ一括生成
- 成人向け画像生成
- Queue、Worker、課金DB契約の変更
- Desktop、Stripe、Marketplace

## 完了条件

- Promptを手入力せず選択コマからJob登録できる
- Release 5由来ではないProject、別所有者、成人向け入力を拒否する
- Feature Flag未設定時はDB・Providerアクセス前に停止する
- 既存quota、moderation、料金予約、Worker処理を迂回しない
- Promptを画面、URL、ログへ表示しない
- モックProviderでJob完了Assetを対象コマへ配置できる構造を検証する
