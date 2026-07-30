# MANGAI Cloud Release 4 実装計画

## 目的

Release 3で採用した一般向けシナリオを、漫画制作に使えるページ・コマ単位のネームへ変換する。
初稿、修正版、採用版を追跡し、画像生成またはCloud Canvas変換の固定入力を作る。

## 今回の対象

1. 採用済みシナリオからのAIネーム生成
2. 8〜48ページ、各ページ1〜6コマの構造化
3. 構図、人物、背景、動作、感情、セリフ、ページ送りフック
4. 初稿・修正版の追記型履歴
5. 詳細再表示と採用
6. Feature Flag、rate limit、所有者RLS、migration、preflight

## 対象外

- 画像生成Provider呼出
- Cloud CanvasへのProject自動作成
- Canvas Editor本体
- 成人向けデータの外部送信
- Stripe、Marketplace、Desktop

## 完了条件

- 採用シナリオがない場合は生成できない
- ページ番号・コマ番号・シーン参照・ページ数を保存前に検証する
- 初稿、修正版、履歴、再表示、採用が完走する
- 別利用者のネームを参照・採用できない
- Feature Flag未設定時にDB・Providerアクセス前でfail closed
- 内部Provider応答とDBエラーを利用者へ露出しない
- 品質ゲート、Draft PR、Vercel Previewが成功する
