# MANGAI Cloud 成人向け企画ブリーフ仕様

## 1. 目的

成人向け市場分析を完了した許可利用者が、分析結果を次の制作条件へ整理し、企画ブリーフとして保存・再表示できるようにする。初期版は外部AIを利用しない。

## 2. 利用条件

次の条件をすべて満たす場合だけ利用できる。

1. `CLOUD_RESEARCH_MVP_ENABLED=true`
2. `CLOUD_ADULT_RESEARCH_ENABLED=true`
3. `CLOUD_ADULT_PLANNING_ENABLED=true`
4. 成人向け市場分析のDB Kill Switchが有効
5. 成人向け市場分析の個別許可が有効期限内
6. 18歳以上確認と`adult-research-v1`規約同意が有効
7. `adult_planning`機能許可が`approved`かつ有効期限内
8. 引継ぎ元Reportが本人所有かつ`contentClass='adult'`

## 3. 機能単位権限

`cloud_adult_feature_grants`で成人向け機能ごとの追加許可を管理する。初期版のFeature Keyは`adult_planning`だけとする。

- 状態: `approved`、`suspended`、`expired`
- 許可理由: `purchase`、`legacy_purchase`、`admin_grant`、`campaign`
- 管理者、対象利用者、期限、メモ、変更前後を監査する

成人向け市場分析の基本権限は成人向けCloud利用の土台として維持し、企画機能はその上に追加許可する。

## 4. 企画ブリーフ

保存項目:

- 仮タイトル
- 企画コンセプト
- 主人公
- 主人公の目的
- 中心となる対立
- 読者への約束
- トーン・雰囲気
- 差別化ポイント
- 結末の方向性
- 制作メモ
- 状態（下書き／企画条件確定）

市場分析Report ID、所有者、成人向け区分、作成日時、更新日時を併せて保存する。利用者画面には市場分析の内部評価ロジックや出典URLを表示しない。

## 5. 画面

- `/dashboard/research/[reportId]/proposal`
  - 一般向けReport: 従来のRelease 2案内
  - 成人向けReport: 権限状態、既存ブリーフ履歴、入力Form
- `/dashboard/research/[reportId]/proposal/[briefId]`
  - 保存済みブリーフの再表示
- `/admin/users/[id]`
  - `adult_planning`の個別許可・停止・期限設定

## 6. DB・RLS

- `cloud_adult_feature_grants`: 機能単位許可
- `cloud_adult_planning_briefs`: 成人向け企画ブリーフ
- `can_use_cloud_adult_feature(feature_key)`: 成人向け基本条件と機能許可の共通判定

企画ブリーフのSELECT／INSERTは、本人所有、成人向けReportとの所有関係、`adult_planning`利用可能状態をすべて満たす場合だけ許可する。初期版では保存後のUPDATE／DELETEを提供せず、修正版は新しいブリーフとして保存する。

## 7. 対象外

- AIによる企画案の自動生成
- 露骨な成人向け文章の外部Provider送信
- シナリオ・台詞・画像生成
- Stripe購入完了からの自動許可
- 作品公開・販売
- 本番環境の有効化

## 8. 完了条件

- 成人向けReport → 入力 → 保存 → 履歴 → 再表示が完走する
- 一般向けReportから成人向けブリーフを作成できない
- 別利用者のReport・ブリーフを参照できない
- Feature Flag、基本成人権限、機能権限のどれかを停止するとfail closedする
- migration forward／rollback／reapplyとcanonical schemaが成功する
- lint、typecheck、Hub test、build、CIが成功する
