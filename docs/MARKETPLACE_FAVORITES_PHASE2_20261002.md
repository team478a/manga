# Marketplace Phase 2-1 お気に入り（あとで読む）

## 1. 目的

購入前に気になった公開一般作品を、購入権限や本棚とは分離して本人だけが保存・解除・一覧確認できるようにする。Phase 2の最初の機能として、人気集計や行動追跡へ広げず、buyer-workの最小関係に閉じる。

## 2. 利用者向け機能

- Marketplace Home、作品一覧、作品詳細の同じハート操作で追加・解除する。
- ログアウト中の操作はログイン後に元のMarketplace画面へ戻す。
- ログイン中は`/dashboard/favorites`で保存順に一覧確認できる。
- 一覧には公開中の一般作品だけを表示する。非公開化または区分変更された作品は表示しない。
- お気に入りは本棚、購入、Reader権限、Checkout可否を変更しない。
- DB契約が未適用または一時的に利用できない場合、既存Marketplaceを壊さず操作を隠し、専用一覧では保存状態を失っていないことを案内する。

## 3. DB・権限契約

- Migration: `202610020001_marketplace_favorites`
- Forward SHA-256: `8868fac7836c09fb54b8da0446de6d847816a726562e23acf5d79a1970381d0f`
- Rollback SHA-256: `29edf154b8a90a652cf99223e7377479d4a794f07e8377c1efdb096cdeaad853`
- Table: `public.marketplace_favorites`
- Columns: `id`、`profile_id`、`work_id`、`created_at`
- `unique (profile_id, work_id)`で同一作品の重複保存を防ぐ。
- `profile_id`と`work_id`は削除時cascadeとし、孤立行を残さない。
- authenticatedは本人行のSELECT／INSERT／DELETEだけを行える。UPDATE権限とanon権限は付与しない。
- INSERTは公開中の`content_class = 'general'`作品だけを許可する。
- Server Actionも認証と本人profileを再確認し、追加時は公開一般作品を再確認する。重複INSERTと存在しないDELETEを冪等に扱い、非公開化後も本人は自分の保存行を安全に解除できる。

## 4. 対象外

- お気に入り件数の公開、人気順、ランキング、急上昇
- 通知、Creatorフォロー、レビュー、星評価
- レコメンド、閲覧・行動追跡、Continue Reading
- 成人向け作品、購入権限、Reader、Checkout、注文、決済の変更

## 5. 配備と受入れ

1. コード、forward／rollback、manifest、schema、テストはPR #611でmerge済み。
2. 責任者の明示承認後、Productionへ`202610020001_marketplace_favorites`を1回適用済み。
3. Production既定付与の過剰権限はPR #612と`202610020002_marketplace_favorites_privilege_hardening`で修復済み。
4. 認証済み空状態はProductionスクリーンショットで合格。追加、重複追加、解除、再解除、一覧カード、非公開作品の非表示は未実施。
5. 問題時は新規操作を停止し、rollback適用の可否を責任者判断とする。自動的に保存データを削除しない。

Production migration以外のデータ、作品公開状態、商品、注文、決済、Provider、creditは変更していない。

## 6. 検証

- お気に入り・Marketplace集中31/31成功
- Hub全テスト1240/1240成功
- Hub typecheck、ESLint成功
- 依存境界error 0（既知warning 2）、新規size regression 0
- Production build成功
- migration manifest／checksum／rollback静的93/93成功
- `git diff --check`成功

Production migration適用後の実データ受入れは、本PRのローカル検証とは分離して記録する。

## 7. Production UI空状態受入れ

2026-10-02、責任者提供のスクリーンショットで`https://app.mang-ai.com/dashboard/favorites`を利用者`tanaka`のログイン状態で確認した。

- Headerの「あとで読む」導線: 表示
- ページ見出しと購入から分離した説明: 表示
- 空状態「あとで読むはまだ空です。」: 表示
- Marketplaceへ戻る「漫画を探す」CTA: 表示
- migration未適用／権限エラー: 表示なし
- DB postflight row 0件との整合: 一致

公開一般作品がないため、追加・解除・作品カード・重複追加・再解除・非公開化後の非表示は`NOT_RUN`。実操作E2Eは責任者の別承認と既存実作品が必要であり、この受入れではProductionデータを変更していない。
