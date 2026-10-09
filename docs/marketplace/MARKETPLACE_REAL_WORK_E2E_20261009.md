# Marketplace 実作品E2E（2026-10-09）

作成日: 2026-10-09  
対象: `feature/manga-canvas-mvp`  
状態: `STAGING_READY / FIXTURE_READY / SELLER_S01_S09_PASS / BUYER_B01_B11_PASS / PAYMENT_FAILURE_E01_PASS / DOWNLOAD_GUARD_E06_PASS / READER_E07_PASS / DOWNLOAD_E08_PASS / MOBILE_E09_PASS / E02_E03_PENDING`

### 2026-10-09 隔離Preview実行準備の結果

- strict preflightはSupabase isolation、Checkout test mode、Stripe test credentialsの3/3が`READY`。
- Stripe test webhookの実配送はHTTP 200。Stripe live request、実決済、注文作成は0件。
- Preview Branchだけへ必要な12 migrationを適用し、再dry-runでup to dateを確認した。Production DBは変更していない。
- 合成Seller／Buyer／未購入者、一般向け非公開2ページ作品、release checkpoint、固定Publication、paused 100円商品、注文0件を準備した。fixture監査は8/8 `READY`、再実行も同結果で冪等。
- Vercel Previewのanon key不一致を修正して再deployした。`/works`は読込エラーから正常な「0件／公開作品はまだありません」へ復旧した。
- 認証済みSeller画面でS-01〜S-05をPASSとし、制作進捗100%、固定版v1・2ページ、Reader全2ページ、paused商品、税込100円を確認した。
- 責任者のaction-time承認後、隔離PreviewでS-07〜S-09を実行してPASSとした。Marketplace一覧1件、作品詳細の税込100円テスト販売、売上管理の注文0件・売上0円を確認した。
- 合成Buyerで検索、作品詳細、あとで読む、試し読み、購入準備を確認し、S-06とB-01〜B-05をPASSとした。未購入状態で2ページ目を直接指定してもサンプル1ページ目に制限された。
- 責任者のaction-time承認後、Stripe Sandboxの100円テスト支払いを確定した。実請求なしの完了画面、注文1件の`paid`／`test`／100円遷移、本棚1冊、Reader全2ページ、2ページ目からの再開、購入履歴経由の2ページPDF downloadを確認し、B-06〜B-11をPASSとした。Seller所有者、未購入者sample-only、支払済みBuyerの3主体でE-07もPASS。Production、Stripe live、実利用者、Provider、creditは変更していない。
- Chromeの実ブラウザを390x844 viewportに固定し、合成BuyerでHome、タイトル検索、作品詳細、あとで読む、本棚、Reader、読書位置の保存・復帰、購入準備画面までを確認した。全画面でdocumentの横overflowはなく、mobile navigationから主要導線へ遷移できた。購入確定ボタンは押しておらず、決済・注文・downloadは発生していない。E-09をPASSとした。
- 責任者のaction-time承認後、隔離Previewへ一時的な未購入Buyerを作成し、Buyer Aのpaid／test注文のdownload URLへ認証済みで直接アクセスした。購入履歴へ`RESOURCE_NOT_FOUND`付きで戻され、本棚は空、注文のstatus／payment mode／download countは不変だった。ログアウト後に一時Auth userを削除し、cascadeされたprofileが存在しないことを確認した。E-06をPASSとした。

### 2026-10-09 外部設定の再監査

- linked Vercel projectは`mangai-hub-staging`。
- Preview targetには、隔離Supabase、Staging ref、Checkout test mode、Stripe test、fixture識別子に必要な設定名が存在しない。
- Production targetにはSupabase URL、anon key、service-role key、Cancel Secretの設定名が存在する。値は取得・表示・記録していない。
- GitHubのRepository、Preview environment、Production environmentにも、該当するStaging／Stripe／Marketplace用Secret・Variable名は存在しない。
- `marketplace:staging:preflight`は3項目すべて`PENDING`を再確認した。Production mutation、Stripe request、Payment作成は0件。
- Supabase管理画面はブラウザ連携エラーのためProject一覧を確認できず、隔離Projectが既存か新規作成が必要かは未確定。
- 改善後の集中テスト9/9、Hub全1268/1268、Hub／Desktop型検査、全lint、依存境界error 0（既知warning 2）、Production build、diff checkが成功した。

preflightは今後、値を表示せずに`Preview:`／`Production:`付きで不足設定名を表示する。設定値が存在しても分離条件やprefixが不正な場合は、従来どおり一般化した検証理由だけを表示する。

## 1. 結論

Marketplace実作品E2Eの実行項目、証跡、停止条件を固定しました。Repository上のSeller、Buyer、Checkout、Reader、あとで読む、続きから読む、購入ファイル取得に関する集中テストは72/72成功しています。実E2E開始前の対象fixtureだけをGETで監査するscriptに加え、隔離Preview専用の冪等provisionerを追加しました。

Vercel PreviewはProductionと分離されたSupabase Branch、Checkout `test`、Stripe test資格情報の3条件を満たし、strict preflightは3/3 `READY`です。必要なmigrationと合成fixtureの準備も完了し、fixture監査は8/8 `READY`です。

認証済みSeller／Buyerの正常系E2EはS-01〜S-09、B-01〜B-11をPASSしました。異常系はE-01とE-04〜E-09をPASSし、残りはE-02とE-03です。隔離Previewでのみ作品公開、販売開始、Stripe testの正常注文1件・失敗注文1件、Reader進捗保存、購入PDF取得を実施しています。Production、Stripe live、実利用者データには触れていません。

## 2. 環境preflight

実行コマンド:

```text
npm run marketplace:staging:preflight
```

| 安全条件 | 結果 | 不足 |
| --- | --- | --- |
| Preview Supabase isolation | READY | Preview Branchと親Production refを分離し、URL／anon／service-roleを対象Branchへ限定 |
| Marketplace checkout mode | READY | Preview=`test`。Production targetは変更なし |
| Stripe test credentials | READY | Preview限定test Secret、Webhook Secret、Cancel Secret。test webhook HTTP 200 |

設定値と秘密値は表示・文書化していません。preflight自体はProduction mutation、Stripe request、Payment作成を行いません。test webhookの配送確認はPreview endpointに対して1件だけ実施しました。

実作品fixture監査コマンド:

```text
npm run marketplace:staging:fixture:audit
```

この監査は次の環境変数名だけを入力とし、値を出力しません。

- `MANGAI_STAGING_SELLER_PROFILE_ID`
- `MANGAI_STAGING_BUYER_PROFILE_ID`
- `MANGAI_STAGING_UNPURCHASED_PROFILE_ID`
- `MANGAI_STAGING_E2E_WORK_ID`
- `MANGAI_STAGING_E2E_PRODUCT_ID`

隔離Staging、Checkout test mode、3主体の分離をfail closedで検証した後、対象行だけをGETします。作品・商品・Publication・checkpoint・ページ・注文の内部ID、氏名、メール、作品名、Storage pathは報告へ出しません。Storage objectの取得、ファイルdownload、DB mutation、Stripe requestは行いません。

## 3. テストデータ条件

StagingをREADYにした後、隔離DB内だけに次を用意します。

- Sellerアカウント1件。
- Buyerアカウント1件。Sellerと同一profileにしない。
- 権限確認用の未購入アカウント1件。
- 一般向け・非公開・2ページ・完成版固定済み作品1件。
- 作品の所有者とCloud Projectの所有者が一致すること。
- 完成版Publicationが2ページで、ページ順と画像を目視確認できること。
- 販売下書きは`paused`、価格はStripe testの最小安全額以上であること。
- 試し読みページを1ページだけ設定できること。
- 実行前の対象注文が0件であること。

fixture監査は、上記に加えてCloud Projectの所有者、作品・Publication・release checkpointの所有者、2ページの順序、重複しないStorage path、Publication PDFとpaused商品の参照一致、価格50〜1,000円、試し読み0〜1ページを確認します。試し読み1ページへの変更自体はS-06としてUIから実施するため、監査は変更しません。

Productionの既存非公開2ページ作品をStagingへ複製する場合は、画像以外の個人情報、注文、決済、生成Job、credit台帳をコピーしません。Storage objectも隔離Staging bucketに置きます。

## 4. Seller側

| ID | 検証 | 状態 | 現在の証跡／未実施理由 |
| --- | --- | --- | --- |
| S-01 | 完成作品の確認 | PASS | Creator画面で画像配置2/2、確定2/2、完成進捗100%を確認 |
| S-02 | 完成版Publicationの確認 | PASS | 固定版履歴v1・2ページ、Reader 1/2・2/2を確認 |
| S-03 | 販売用下書きの確認 | PASS | 商品管理で対象商品が停止中であることを確認 |
| S-04 | 表紙・タイトル・説明の確認 | PASS | 作品編集と商品編集で表示内容を確認 |
| S-05 | 販売価格の確認 | PASS | 商品管理・編集で税込100円を確認 |
| S-06 | 試し読みページの設定 | PASS | Buyer未購入状態で1/2ページだけ表示し、2ページ目の直接指定も1ページ目へ制限 |
| S-07 | 作品公開 | PASS | 責任者承認後、隔離Preview画面で作品公開完了を確認 |
| S-08 | 商品販売開始 | PASS | 同じ操作で商品が販売中へ遷移し、税込100円を維持 |
| S-09 | Marketplaceへの掲載 | PASS | 一覧1件、作品詳細、テスト販売表示、Seller注文0件・売上0円を確認 |

## 5. Buyer側

| ID | 検証 | 状態 | 現在の証跡／未実施理由 |
| --- | --- | --- | --- |
| B-01 | Marketplaceで作品を探す | PASS | Buyerでタイトル検索し、1件の販売中作品を確認 |
| B-02 | 作品詳細を開く | PASS | Buyerで作品詳細、作者、税込100円、テスト販売表示を確認 |
| B-03 | あとで読むに追加 | PASS | 追加成功表示と「あとで読む」一覧1件を確認 |
| B-04 | 試し読み | PASS | サンプル1/2ページを表示。2ページ目直接指定は1ページ目へ制限 |
| B-05 | 購入画面へ進む | PASS | 税込100円、Stripe test、Buyerメール、実請求なしの購入準備画面を確認 |
| B-06 | Stripe test決済を完了 | PASS | action-time承認後に100円Sandbox決済を確定。実請求なし完了画面と`paid`／`test`／100円の注文1件を確認 |
| B-07 | 本棚へ追加 | PASS | Buyer本棚にテスト購入作品1冊、税込100円を確認 |
| B-08 | Readerで本編を読む | PASS | 購入済みBuyerが1/2・2/2ページを閲覧できることを確認 |
| B-09 | 途中で閲覧終了 | PASS | 2ページ目表示後に本棚へ戻り、閲覧を終了 |
| B-10 | 続きから読むで復帰 | PASS | 本棚に「続きから読む（2ページ）」が表示され、2/2ページへ復帰。進捗rowもpage 2を確認 |
| B-11 | 購入ファイルをdownload | PASS | 購入履歴から署名URLを再発行して取得。download count 1、PDF 1.7・111,076 bytes・2ページを確認 |

未購入Buyerの有料本文拒否はB-04、支払済みBuyerの全2ページ閲覧はB-08、Seller所有者の全2ページ閲覧はS-02で実画面確認済みです。これら3主体の結果をE-07の証跡とします。

## 6. 異常系

| ID | 検証 | 状態 | 実行方法 |
| --- | --- | --- | --- |
| E-01 | 決済失敗 | PASS | action-time承認後、Stripe Sandboxの公式拒否用test cardで100円の支払いを1回だけ確定。Checkoutの拒否表示、注文`failed`／`test`、`paid_at`なし、download count 0、既存paid注文不変、新規paid注文なしを確認 |
| E-02 | 決済処理中の離脱 | BLOCKED | Checkout cancelへ戻り、pending注文の再利用を確認 |
| E-03 | 同一注文の重複通知 | BLOCKED | 同一test eventの再配送で状態と権限が重複しないことを確認 |
| E-04 | 非公開作品への直接アクセス | PASS | 隔離Previewで合成作品を一時的に非公開化し、匿名の直接URLが404相当（soft 404を含む）となり、作品名を返さないことを確認。直後に公開状態へ復元 |
| E-05 | 販売停止商品の購入防止 | PASS | 合成商品を一時的に`paused`へ戻し、購入画面が404、公開作品ページから商品・Checkout導線が消えることを確認。Server Actionの既存集中テストで注文作成・Stripeより前のstatus再検査も確認し、直後に`active`へ復元 |
| E-06 | 他人の購入ファイルへのアクセス拒否 | PASS | 隔離Previewの認証済み未購入BuyerでBuyer Aのdownload URLへ直接アクセスし、購入履歴へ`RESOURCE_NOT_FOUND`付きで戻ること、本棚0件、download count 1の不変を確認。使用した一時Buyer／profileは確認後に削除 |
| E-07 | Readerの権限確認 | PASS | Seller所有者は全2ページ、未購入Buyerはsample 1ページのみ、支払済みBuyerは全2ページを実画面確認 |
| E-08 | PDF download失敗 | PASS | 新規5分署名URLは直後のRange取得に成功し、実時間失効後は同じURLの取得を拒否。元の購入fileと注文は変更なし |
| E-09 | スマートフォン操作 | PASS | Chrome実ブラウザを390x844に固定し、Home、検索、詳細、あとで読む、本棚、Reader、読書位置の保存・復帰、購入準備を確認。全画面で横overflowなし。購入確定は未実行 |

過去のStaging決済失敗／返金E2E証跡は参考にしますが、2026-10-09の最新環境結果として流用しません。

異常系用に合成未購入者の`pending`／`test`／100円注文を1件だけ隔離Previewへ準備しました。改ざんcancel tokenは拒否され、前後で注文状態は不変です。これはE-02の正規Checkout離脱とは別の認可境界証跡であり、E-02は未実施のままです。Failure／refundのread-only preflightは、VercelのSensitive値がCLIへ返らないため停止し、Secretの回避取得や外部操作は行っていません。

E-01用のfailure/refund harnessは、注文IDとStripe test webhook endpoint IDが未指定の場合、pending／paidのtest注文と互換endpointが各1件だけ存在するときに限り自動選択するよう改善しました。0件・複数件、Production URL、live key、同一Supabase refでは外部更新前に停止します。CLI経由のread-only preflightはVercelのSensitive値を子processへ渡さず安全停止しましたが、ブラウザで隔離Preview、Stripe Sandbox、合成Buyerを確認できたため、責任者のaction-time承認後に拒否支払いを1回だけ実行しました。Checkoutはカード拒否を表示し、対象注文は`failed`／`test`／100円、`paid_at`なし、download count 0になりました。同じBuyer／商品の既存`paid`注文1件は不変で、新しいpaid注文や購入権限は作成されていません。合成Buyerの認証情報は隔離Previewだけで再発行し、値は表示・記録していません。Production、Stripe live、実請求、Provider、creditへの変更は0件です。

E-04／E-05はdeployment `dpl_GxV3w4jDFG54Eg4b4QKrM1JyeJ5c`に対し、`marketplace:staging:access-guards`で実施しました。実行前に隔離Supabase refと親Production refが異なること、Checkoutが`test`であること、paid注文が`test`であることをfail closedで確認しています。商品と作品は条件付きPATCHで一時変更し、失敗時を含む`finally`復元後に`active`／公開へ戻ったことを再読込しました。注文status、payment mode、download countは実行前後で不変でした。Stripe request、Payment作成、Production変更は0件です。

E-06はdeployment `dpl_GxV3w4jDFG54Eg4b4QKrM1JyeJ5c`で確認しました。CLIへSensitive値が返らないためSecretの回避取得は行わず、責任者承認後に隔離Previewだけへ一時的な認証済み未購入Buyerを作成しました。Buyer Aのdownload URLへの直接アクセスは購入履歴へ`download_error=RESOURCE_NOT_FOUND`付きで戻り、本棚は0件でした。実行前後で対象注文は`paid`／`test`／download count 1のまま不変です。ログアウト後に一時Auth userを削除し、profileのcascade削除と対象注文不変を再確認しました。Production、Stripe request、Payment、Provider、creditの変更は0件です。

E-09は隔離Preview deployment `dpl_GxV3w4jDFG54Eg4b4QKrM1JyeJ5c`と合成Buyerを使用しました。viewportは390x844、Scrollbarを除くdocument client widthは375pxで、Home、作品一覧、作品詳細、本棚、Reader、あとで読む、購入準備の各画面に`scrollWidth > clientWidth`はありませんでした。Readerは開始時に前回の2/2ページへ復帰し、1/2ページへ移動後に本棚へ戻ると読書linkが`?page=1`を保持し、同じ1/2ページへ復帰しました。Checkoutは税込100円・Stripe test・実請求なし表示までを確認し、「テスト購入へ進む」は押していません。

## 7. Repository集中テスト

次の17 test file、72 testを実行し、すべて成功しました。

- Marketplace Home／作品詳細。
- あとで読む、続きから読む、本棚。
- Buyer導線、Checkout再試行、運用readiness。
- test/live mode分離、canary、注文Repository境界。
- Cloud出品開始、販売停止、完成preflight。
- 所有者、購入者、未購入者のPublication access契約。

実行結果: `PASS 72 / FAIL 0 / SKIPPED 0`

fixture監査の追加テスト:

- Production指定、同一Supabase ref、同一主体をfail closedで拒否。
- 正常な非公開2ページ完成版、paused商品、注文0件をREADY判定。
- 公開済み作品、active商品、既存注文を拒否。
- 所有者、release checkpoint、ページ構成の不一致を拒否。
- 結果へ識別子を含めず、全requestがGETで個人情報列を選択しないことを確認。

実行結果: `PASS 5 / FAIL 0 / SKIPPED 0`

認証済み別Buyerのdownload拒否用harnessテスト:

- Production、live checkout、通常ドメインをfail closedで拒否。
- Buyer A／Buyer Bの主体分離とBuyer Bの未購入を確認。
- 401／403／404だけを拒否成功とし、署名URLへ進み得る303を失敗扱い。
- 注文status、payment mode、buyer、product、download countの不変を確認。
- Cookieは一時ファイルだけに置き、`finally`で削除する契約を固定。

実行結果: `PASS 5 / FAIL 0 / SKIPPED 0`

E-01 failure/refund harnessの改善テスト:

- selector未指定時は唯一のpending／paid test注文と互換test webhook endpointだけを自動選択。
- 候補0件・複数件、Production URL、live key、不正endpointを外部更新前に拒否。
- 明示selectorの従来契約、拒否PaymentIntent、全額返金、完了済み再実行の冪等性を維持。

実行結果: `PASS 8 / FAIL 0 / SKIPPED 0`

さらにMarketplace名を含む38 test fileを標準のTypeScript stripping付きで一括実行し、`PASS 183 / FAIL 0 / SKIPPED 0`でした。最新Hub全体は`PASS 1285 / FAIL 0 / SKIPPED 0`、Hub型検査、全lint、`git diff --check`も成功しています。既存のmigration 96件検証、依存境界、Production build、Desktop型検査も成功済みです。依存境界は既知warning 2件、新規error 0件です。

これはコード上の契約確認であり、実作品E2EのPASSには数えません。

## 8. 実行順序

1. PreviewとProductionの設定名を再確認する。秘密値は出力しない。
2. `marketplace:staging:preflight:strict`を成功させる。
3. Preview deployment URLとisolated Supabase refを記録する。資格情報は記録しない。
4. Seller、Buyer、未購入者の3アカウントを用意する。
5. 対象IDをrepository外の一時環境ファイルへ設定し、`npm run marketplace:staging:fixture:audit -- --candidate <絶対path>`で非公開2ページ完成作品、Publication、`paused`商品、注文0件をread-only確認する。
6. S-01からS-06を確認する。
7. Staging内でS-07、S-08を実施し、S-09を確認する。
8. B-01からB-11を順番に実施する。
9. E-02とE-03を、正常系とE-01の証跡を壊さない順で実施する。
10. 商品を`paused`、作品を非公開へ戻す。
11. 注文とWebhook結果をread-only確認し、Stripe test endpointを変更した場合は元へ戻す。

## 9. 各項目の証跡

各操作は次を記録します。

- 実行日時とPreview deployment識別子。
- 使用した役割（Seller／Buyer／未購入者）。氏名、メール、内部IDは記録しない。
- 操作前後の公開状態、商品状態、注文状態、Readerページ番号。
- 画面の期待結果と実結果。
- Stripeは`test`であることとevent種別だけ。Secret、payload、Payment IDは記録しない。
- downloadはHTTP結果、ファイル形式、ページ数、破損有無だけ。署名URLを記録しない。
- 不具合は再現手順、原因、修正、再発防止テストを記録する。

## 10. 停止条件

次のいずれかで直ちに停止します。

- Preview SupabaseがProductionと分離されていることを証明できない。
- Checkout modeがtestでない、またはStripe keyがtest用でない。
- Preview以外のdeploymentへWebhookが向いている。
- 対象外の作品、商品、注文が変化した。
- SellerとBuyerが同一profileである。
- 非公開作品または有料本文を未購入者が閲覧できる。
- 他人の購入ファイルを取得できる。
- 同一決済で複数のpaid注文または複数権限が作られる。
- Productionへの書き込み、Stripe live request、実請求の兆候がある。

停止後は自動再試行、Production修正、注文削除、返金、Storage削除を行いません。原因と対象を確定し、必要な操作を別承認に分離します。

## 11. Production境界

今回の準備ではProduction DB、Storage、Vercel Production環境変数、Marketplace作品、商品、注文、決済、Provider、生成Job、credit、成人向けMarketplaceを変更していません。

Productionでの一般公開、販売開始、Stripe live決済、返金、送金は、このStaging E2Eが全項目PASSした後も別の明示承認が必要です。

## 12. 次に必要な操作

1. 完了: Preview限定のisolated Supabase接続を設定した。
2. 完了: Preview限定でCheckout modeを`test`にした。
3. 完了: Preview限定のStripe test資格情報とWebhookを設定し、HTTP 200を確認した。
4. 完了: Previewを再deployし、実行時設定が新しいdeploymentへ反映されたことを確認した。
5. 完了: Staging用のSeller、Buyer、未購入者と非公開2ページ完成作品を用意した。
6. 完了: strict preflight 3/3、fixture監査8/8、S-01〜S-09、B-01〜B-11、E-07を成功させた。
7. 完了: E-08の新規5分署名URL即時取得と実時間失効後の取得拒否、改ざんcancel token拒否、注文不変を確認した。
8. 完了: E-04非公開直接アクセスとE-05販売停止購入防止を隔離PreviewでPASS。匿名download拒否を部分確認し、fixtureを元の公開／active状態へ復元した。
9. 完了: E-09スマートフォン操作を390x844の実ブラウザでPASSとし、購入確定なしで主要導線と読書位置復帰を確認した。
10. 完了: E-06を認証済み別BuyerでPASSとし、一時Buyer／profileを削除、対象注文不変を確認した。
11. 次: E-02正規Checkout離脱、E-03重複通知を隔離Previewで実施する。各外部確定操作はaction-time確認を分離する。

### 12.1 2026-10-09 Preview設定結果

- Supabase Preview Branch `marketplace-e2e-20261009`を接続先とし、親Productionとは異なるBranchであることを確認した。
- Supabase URL、anon key、service-role key、Preview／親ref、`MANGAI_DB_ENV=staging`、Checkout mode `test`の7件はVercel Preview専用で、git branch限定なし。
- anon／service-role JWTは値を出力せず、roleとproject refだけを対象Branchと照合した。
- Vercel Production、Production DB／Storage、Stripe、Webhook、fixture、注文、決済、公開・販売は変更していない。
- strict runtime preflightはSupabase isolation、Checkout mode、Stripe test credentialsの3/3が`READY`。Sensitive値を取得できない場合はPreview限定metadataで判定し、明示的なlive keyは拒否する。
- PR #629のPreview deploymentは`Ready`で、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。

これらは外部設定またはStagingデータ変更を伴うため、対象環境と変更内容を示した実行時承認後に行います。
