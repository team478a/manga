# MANGAI Cloud Release 3 実装計画

## 目的

Release 2で採用した一般向け漫画企画を、制作判断に使えるシナリオへ変換する。
初稿、修正版、採用版を追跡でき、次のRelease 4「マンガ生成」へ固定した入力を渡せる状態を完了条件とする。

## 対象

1. 採用済み企画からのAIシナリオ生成
2. 登場人物、三幕構成、ページ範囲付きシーンの構造化
3. 初稿と修正版の追記型履歴
4. 版の再表示と採用
5. 所有者分離、Feature Flag、入力・応答検証、rate limit
6. loading、empty、error、not found状態
7. migration、rollback、canonical schema、自動テスト

## 対象外

- Cloud Canvas Editor、マンガ画像生成
- 成人向けデータの外部AI送信
- Stripe、Marketplace、Desktop
- 市場分析、企画提案の既存契約変更

## 実装順

1. ドメインschemaとAI Provider境界
2. 追記型永続化とRLS
3. Server Actions
4. シナリオ一覧・詳細・修正・採用UI
5. Release 2からの導線
6. 自動テストと品質ゲート

## 完了条件

- 採用企画がない場合は生成できない
- 初稿生成、修正版生成、履歴表示、詳細再表示、採用が完走する
- 別ユーザーの版を参照・採用できない
- 不正UUIDはDB参照前に拒否する
- Provider、DBの内部情報を利用者へ表示しない
- Feature Flag未設定時はfail closed
- 390px、768px、1280pxで横overflowを生まない構造
- 全品質ゲート成功、Draft PRとVercel Preview作成
