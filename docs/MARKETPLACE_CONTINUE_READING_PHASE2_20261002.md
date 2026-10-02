# Marketplace Phase 2-2 続きから読む

作成日: 2026-10-02
対象: 一般向けCloud Marketplaceの固定公開版Reader
状態: 実装・ローカル検証済み。Production migration適用・postflight合格。

## 1. 利用者向けの動作

- ログイン済み利用者が固定公開版Readerを開くと、表示した最終ページを保存する。
- 作品詳細からページ指定なしでReaderを開いた場合、現在の公開版に保存されたページから再開する。
- 本棚では2ページ目以降の保存がある作品を「続きから読む（Nページ）」と表示する。
- URLでページを明示した場合はURLを優先する。保存ページが現在の閲覧可能範囲外なら先頭の閲覧可能ページへ戻す。
- 匿名利用者は保存しない。未購入のログイン利用者は公開中のサンプルページだけを保存できる。

## 2. データと権限

- `marketplace_reading_progress`は`profile_id + work_id + publication_id`を主キーにする。
- 公開版IDをキーに含めるため、公開版差し替え後に旧版のページを現行版へ流用しない。
- authenticatedのtable権限は本人行のSELECTだけ。書込は`save_marketplace_reading_progress` RPCに限定する。
- RPCは現在版、一般向け作品、実在ページを検証する。作者または支払済み購入者は本文、その他は公開中サンプルだけを保存できる。
- 自動判定や進捗保存で作品、注文、購入権限、画像を削除・変更しない。

## 3. 障害時の動作

- migration未適用、DB読込失敗、保存失敗では進捗機能だけを停止し、従来のReaderと本棚を継続する。
- 保存Actionは画面遷移や再検証を発生させず、Readerの閲覧を妨げない。
- 購入・作者判定は既存Reader entitlementを正本とし、公開停止後も既存の支払済み購入者と作者の閲覧権限を変更しない。

## 4. Migration

- ID: `202610020003_marketplace_reading_progress`
- Forward SHA-256: `34c5c316060910aa7531ad4ac50d11b144b9a51714d1c558740e75010d7d959a`
- Rollback SHA-256: `691ae0506ef0504896f41ae24d53aed877e970b3ba0f3d1bf7f5f13dcf55cc96`
- 実装PR merge後、責任者の明示承認を受けてProduction Project `vmdsyxykcrgxcdbrwlkv`へ1回適用した。postflightでtable、RLS、primary key、index、owner read policy、RPC、最小権限、初期row数0を確認した。

## 5. 対象外

- 閲覧率・分析ダッシュボード
- 読了通知、推薦、ランキング、レビュー、フォロー
- 匿名端末をまたぐ進捗同期
- 成人向けDesktop作品
- Productionデータ作成、Provider実行、credit消費

## 6. 検証

- 集中テスト: 追加3件およびMarketplace関連138件成功。
- migration／rollback checksum検証: 95件成功。
- Hub全1243/1243、Hub typecheck、ESLint、依存境界（error 0、既知warning 2）、Production build、diff check成功。
