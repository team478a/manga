# Cloud成人向け作品管理 v1 実装計画

## 目的

成人向けCanvas Projectを一般向け公開作品と混在させず、本人だけが非公開作品として一覧・詳細管理できるようにする。

## 実装範囲

- `cloud_projects.content_class = adult`を作品の正本として利用
- 成人向け専用の制作状態・管理メモを保存
- 成人向け作品一覧、詳細、タイトル・説明・制作状態の更新
- Canvas編集、本編PDF、連番画像への安全な導線
- 環境Feature FlagとDB Kill Switchによるfail-closed
- 所有者限定RLS、不正UUID・他人の作品・一般向けProjectの拒否
- 一般向け作品管理との画面上の明確な区分

## 変更しない範囲

- `works`への成人向け作品登録
- 作品公開、共同編集、Marketplace、販売パッケージ
- 成人向け画像生成、外部Provider送信
- Stripe、Desktop、一般向け業務ロジック

## 安全境界

1. `CLOUD_ADULT_WORK_MANAGEMENT_ENABLED=true`でなければDBアクセス前に停止する。
2. DB Kill Switch、既存の成人向けネーム許可・本人同意がすべて有効な場合だけ利用できる。
3. `cloud_projects`は`adult`、`private`、`18歳以上`を維持する。
4. 一般向け`works`、Marketplace同期、一般向け画像生成へ成人向けProjectを渡さない。
5. DB内部エラーを利用者へ表示しない。

## 完了条件

- 一覧、詳細、更新、Canvas遷移、書き出し導線が所有者本人で完走する。
- 一般向け・他人・不正UUID・Feature Flag停止時にfail closedする。
- migration forward／rollback／canonical schemaとpreflightを検証する。
- 全品質ゲートとDraft PR／Previewを確認する。
