# Marketplace UIマージ後受入れ・Phase 2スコープ監査

## 1. 結論

Marketplace UI-1〜5はPR #602で実装され、PR #607で引き継ぎ文書まで`feature/manga-canvas-mvp`へ反映された。次に行うべき作業は、新機能の推測実装ではなく、実作品と認証済み購入データを使うread-only受入れ確認である。

Phase 2候補には現行の保存契約がない。受入れ確認後に着手する最初の候補は「お気に入り（あとで読む）」を推奨するが、DB migration、RLS、Server Action、表示位置の明示承認が必要であり、この監査では実装しない。

## 2. 監査基準

- Base: `feature/manga-canvas-mvp` merge commit `b1645081`
- Marketplace UI実装: PR #602、merge commit `8882c15b`
- 引き継ぎ更新: PR #607、merge commit `342cdf12`
- 現行schemaのMarketplace主要テーブル: `profiles`、`works`、`digital_products`、`orders`、`cloud_work_publications`、`cloud_work_publication_pages`
- GitHub上にMarketplace Phase 2を定義するopen Issueは見つからなかった。

## 3. 次タスク: 実データread-only受入れ

### 公開画面

1. `/`で実表紙、作者、価格、注目・新着・ジャンル・試し読み棚を確認する。
2. `/works`で検索、タグ、販売中filter、スマホ2列／PC4〜5列を確認する。
3. `/works/[id]`で表紙、作者、タグ、あらすじ、試し読み、価格、購入CTAを確認する。
4. `/works/[id]/read`でsample公開範囲とページ移動を確認する。購入・Checkoutは実行しない。

### 認証済み購入者画面

1. `/dashboard/purchases`で実表紙、作者、購入日、価格、paid／refunded表示を確認する。
2. 既存の購入権限でReaderが固定publicationを表示することを確認する。
3. DownloadはURL発行前までの表示確認を基本とし、実ダウンロードが必要な場合は別途対象を明示する。

### 現在の外部環境状態

- LocalにはSupabase資格情報と認証済み購入データがなく、実データ目視はできない。
- 監査時点のmerge commit `342cdf12`のVercel Production deploymentはsuccess。
- deployment URLへの匿名HTTPはVercel SSOへ`302`転送される。認証済みブラウザ操作の明示承認なしでは画面受入れを継続しない。
- 過去の隔離Stagingは終了済みであり、再作成・課金・秘密情報設定は別承認事項である。

上記が解消しない場合は`BLOCKED_EXTERNAL_ENVIRONMENT`として記録し、静的テストやCI成功を実データ受入れ成功とは扱わない。

## 4. Phase 2候補の契約監査

| 候補 | 現行契約 | 新たに必要な主な契約 | 判定 |
| --- | --- | --- | --- |
| お気に入り／あとで読む | なし | buyer profileとworkの一意関係、RLS、冪等な追加・解除、一覧取得 | 最初の候補として推奨 |
| Continue Reading | Readerは`?page=`でページ移動するだけで永続化なし | profile・work・publication単位の最終ページ、更新時刻、sampleと購入済みの扱い | お気に入り後 |
| Creatorフォロー | なし | follower・creatorの一意関係、RLS、Creator公開導線。通知は別契約 | 後続候補 |
| レビュー／星評価 | なし | 購入者限定条件、編集・削除、moderation、集計、返金時の扱い | 仕様負荷が高いため後続 |
| 人気ランキング／急上昇 | 閲覧イベント・ランキング集計なし | 対象signal、期間、同率処理、不正操作対策、公開基準 | 集計契約確定後 |
| レコメンド | 行動signal・推薦契約なし | 使用データ、同意、説明可能性、cold start、評価方法 | 最後に検討 |

既存の`orders`は購入権限と売上の正本であり、人気順や推薦を推測するために流用しない。既存のmonitor用ratingもMarketplace作品評価へ流用しない。

## 5. 推奨するPhase 2-1最小範囲

実データ受入れ完了後、明示承認を得て「お気に入り（あとで読む）」だけを独立Phaseとして実装する。

- 認証済みbuyerが公開一般作品を追加・解除できる。
- 同じbuyer・workの重複を許さない。
- 作品カードと作品詳細に同一状態を表示する。
- 本棚とは分離し、購入済み判定を変更しない。
- お気に入り件数、人気順、通知、Creatorフォロー、レビュー、レコメンドは含めない。
- migrationはforward／rollback、manifest、checksum、RLS、権限テストを同じPRに含める。

## 6. 安全境界

この監査ではコード、DB schema／migration、Production作品、商品active化、publication、Checkout、Stripe、注文、決済、環境変数を変更していない。Phase 2-1の推薦は実装承認ではない。
