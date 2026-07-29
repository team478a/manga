# MANGAI Cloud 成人向け市場分析オプション仕様

## 1. 目的

成人向け作品の購入者・許可利用者に対し、市場分析だけをMANGAI Cloudで提供する。画像生成、本文生成、成人向け作品公開、決済自動連携は本仕様に含めない。

## 2. 安全境界

成人向け市場分析を実行できるのは、次の条件をすべて満たす場合だけとする。

1. `CLOUD_RESEARCH_MVP_ENABLED=true`
2. `CLOUD_ADULT_RESEARCH_ENABLED=true`
3. DB側Kill Switch `cloud_adult_research_settings.enabled=true`
4. 管理者が個別利用権限を`approved`に設定
5. 利用期限内
6. 利用者本人が18歳以上を確認
7. 利用者本人が`adult-research-v1`規約へ同意

いずれかが欠ける場合はfail closedする。一般向け市場分析には成人向け権限を要求しない。

## 3. 権限モデル

個別状態は`approved`、`suspended`、`expired`。許可理由は`purchase`、`legacy_purchase`、`admin_grant`、`campaign`とする。初期公開ではStripeとの自動連携を行わず、管理者がユーザー詳細画面から付与する。

## 4. 本人同意

権限付与と本人同意を別テーブルで保持する。管理者が本人の代わりに年齢確認・規約同意を登録することはできない。

- 生年月日は保存しない
- 18歳以上の自己確認日時を保存
- 規約versionと同意日時を保存
- 利用者は同意を解除できる

同意解除後は、成人向けReportの新規作成と再表示をRLSで拒否する。

## 5. DB・RLS

- `cloud_adult_research_settings`: DB側Kill Switch
- `cloud_adult_research_entitlements`: 管理者付与権限
- `cloud_adult_research_consents`: 本人確認・規約同意
- `cloud_adult_research_audit_logs`: 全体設定、権限変更、同意変更の監査
- `can_use_cloud_adult_research()`: RLS共通判定

`cloud_market_research_reports.input.contentClass='adult'`のinsert・selectは、`can_use_cloud_adult_research()`がtrueの場合だけ許可する。別利用者のReport参照は従来どおり拒否する。

## 6. 管理操作

- `/admin/adult-research`: 環境Flag、DB Kill Switch、許可数の確認
- `/admin/users/[id]`: 個別の許可・停止・期限切れ・許可理由・期限・管理者メモ

管理操作は`requireAdmin()`とService Role専用RPCの両方で確認し、権限更新と監査記録を同一DB transaction内で確定する。

## 7. 利用者操作

- `/dashboard/research/adult-access`: 利用状態、年齢確認、規約同意、同意解除
- `/dashboard/research/new`: 利用可能な場合だけ成人向け選択肢を有効化
- 履歴・結果: 一般／成人向け区分を表示する

利用者UIには出典URL、内部評価ロジック、内部DBエラーを表示しない。

## 8. 今回含めないもの

- 成人向け画像・本文生成
- Cloud Canvas Editor
- Stripe購入完了からの自動権限付与
- 成人向け作品公開・販売
- 外部Providerへの成人向けPrompt送信
- 身分証明書による年齢確認

## 9. 公開順序

1. migration適用
2. 環境変数は`false`のまま管理画面・RLSを確認
3. 既存購入者へ`legacy_purchase`権限を付与
4. Previewで環境FlagとDB Kill Switchを有効化
5. テスト利用者が本人同意
6. 入力、保存、履歴、再表示、停止後拒否を確認
7. 責任者承認後に限定公開
