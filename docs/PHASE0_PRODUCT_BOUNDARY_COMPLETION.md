# MANGAI Phase 0 製品境界・安全契約 完了報告

完了日: 2026-07-18

## 結論

一般漫画を扱うMANGAI Cloud／Hubと、成人向け漫画を扱うMANGAI Desktop Adultの境界を型、Desktop main process、Web server、Supabase RLS／Storage policyの各層へ実装した。成人向けまたは区分不明の入力は、一般向けCloudへの保存・取込・販売・Checkoutを拒否する。

## 実装した契約

- 共通schema: `ContentClass`、`ProductSurface`、`ExecutionTarget`、`ContentExecutionPolicy`
- Project: `contentClass`を追加。既存データは既知の一般年齢区分だけを`general`、未知を`adult`へ移行
- Desktop: 新規作成時に一般／成人を明示選択。成人向けは`local_only`が既定
- 区分変更: 一般から成人への一方向移行のみ許可。待機中の外部Jobを停止し、予約費用を解放
- 販売パッケージ: manifest v2へ`contentClass`、`createdBySurface`、`policyVersion`を追加。v1 readerは安全側へ補完
- Cloud／Hub: 成人向けパッケージ取込、作品保存、公開一覧、商品・グッズ・Checkout、Desktop Hub更新を一般向けに限定
- Storage: 新規Cloud保存先を`general/` namespaceへ限定
- Supabase: `works.content_class`、CHECK制約、index、RLS、関連商品／注文／Storageの境界policyをforward／rollback migrationで追加
- 表示: Desktopの日英区分表示、不可逆な成人向け移行案内、Cloudの一般向け限定表示を追加

## 境界matrix

| 作品区分        | surface | 実行・保存先                  | 結果                                                     |
| --------------- | ------- | ----------------------------- | -------------------------------------------------------- |
| general         | cloud   | cloud provider／Cloud Storage | 許可                                                     |
| general         | desktop | local／承認済み外部経路       | Project policyに従う                                     |
| adult           | cloud   | API／Storage／販売取込        | 拒否                                                     |
| adult           | desktop | local                         | 許可・既定                                               |
| adult           | desktop | external BYOK                 | 年齢・規約・Provider・モデル・都度確認・費用上限を再評価 |
| unknown／legacy | cloud   | 任意                          | adult扱いで拒否                                          |

## 防御層

ブラウザーやrendererの表示値だけには依存しない。Web server action、販売パッケージ再検証、Electron main process、SQLite policy、PostgreSQL制約／RLS／Storage policyで同じ境界を再判定する。UIを改変してもCloud側の永続化境界は通過できない。

## 検証範囲

- 共通matrixとlegacy推論の単体テスト
- 成人向け販売パッケージ、Cloud保存、Checkoutの否定テスト
- Desktop DB migration、移行前backup、一般→成人の不可逆移行、local-only policyのテスト
- Desktop main processのDB統合テストとIPC schema／型検査
- Supabase migration／rollback構造検証とstaging assertion
- Hub TypeScript／ESLint／test／production build
- Desktop TypeScript／ESLint／test／production build／axe監査

実環境Supabaseへmigrationを適用する作業は環境認証を伴うため、Phase 0のコード完了とは分離し、RC受入れで実施する。

## 次フェーズ

Phase 1は一般向けCloud Creatorデータ基盤を実装する。`cloud_projects`、Episode、Page、Asset、Canvas snapshot、revision、RLS、非公開Storageを追加し、成人向けmanifestのimport拒否を維持する。
