# Marketplace 実作品E2E（2026-10-09）

作成日: 2026-10-09  
対象: `feature/manga-canvas-mvp`  
状態: `STAGING_READY / FIXTURE_READY / PUBLIC_LIST_SMOKE_PASS / SELLER_S01_S05_PASS / PUBLISH_ACTION_CONFIRMATION_PENDING`

### 2026-10-09 隔離Preview実行準備の結果

- strict preflightはSupabase isolation、Checkout test mode、Stripe test credentialsの3/3が`READY`。
- Stripe test webhookの実配送はHTTP 200。Stripe live request、実決済、注文作成は0件。
- Preview Branchだけへ必要な12 migrationを適用し、再dry-runでup to dateを確認した。Production DBは変更していない。
- 合成Seller／Buyer／未購入者、一般向け非公開2ページ作品、release checkpoint、固定Publication、paused 100円商品、注文0件を準備した。fixture監査は8/8 `READY`、再実行も同結果で冪等。
- Vercel Previewのanon key不一致を修正して再deployした。`/works`は読込エラーから正常な「0件／公開作品はまだありません」へ復旧した。
- 認証済みSeller画面でS-01〜S-05をPASSとし、制作進捗100%、固定版v1・2ページ、Reader全2ページ、paused商品、税込100円を確認した。公開、販売開始、Buyer操作、Stripe test決済、購入後Reader、download、異常系は未実施。Production、公開作品、販売、Provider、creditは変更していない。

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

公開作品一覧の匿名smokeは正常空状態まで確認しました。認証済みSeller／Buyer E2E、公開、販売開始、注文作成、Stripe test決済、Reader進捗保存は未実施です。Production、Stripe live、実利用者データには触れていません。

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
| S-06 | 試し読みページの設定 | NOT_RUN | DB上は1ページsample。公開後に未購入者Readerで実効性を確認する |
| S-07 | 作品公開 | NOT_RUN | Preview画面で最終確認待ち |
| S-08 | 商品販売開始 | NOT_RUN | S-07と同じ確認操作で実行予定 |
| S-09 | Marketplaceへの掲載 | NOT_RUN | S-07、S-08成功後に実施 |

## 5. Buyer側

| ID | 検証 | 状態 | 現在の証跡／未実施理由 |
| --- | --- | --- | --- |
| B-01 | Marketplaceで作品を探す | BLOCKED | 掲載対象がない |
| B-02 | 作品詳細を開く | BLOCKED | 掲載対象がない |
| B-03 | あとで読むに追加 | BLOCKED | Buyer未ログイン、作品未掲載 |
| B-04 | 試し読み | BLOCKED | sampleは準備済みだが作品未掲載 |
| B-05 | 購入画面へ進む | BLOCKED | Stripe test modeはREADY、商品未販売 |
| B-06 | Stripe test決済を完了 | NOT_RUN | test資格情報とWebhookはREADY、商品未販売 |
| B-07 | 本棚へ追加 | BLOCKED | paid test注文がない |
| B-08 | Readerで本編を読む | BLOCKED | paid test注文がない |
| B-09 | 途中で閲覧終了 | BLOCKED | Readerを開始していない |
| B-10 | 続きから読むで復帰 | BLOCKED | Staging進捗rowを作成していない |
| B-11 | 購入ファイルをdownload | BLOCKED | paid test注文がない |

未購入者の有料本文拒否は、実行時にB-04の試し読み成功後、B-06の前後で別アカウントから確認します。Repository契約テストは権限境界を確認済みですが、実環境結果の代用にはしません。

## 6. 異常系

| ID | 検証 | 状態 | 実行方法 |
| --- | --- | --- | --- |
| E-01 | 決済失敗 | BLOCKED | Stripe公式の拒否用test PaymentMethodだけを使用 |
| E-02 | 決済処理中の離脱 | BLOCKED | Checkout cancelへ戻り、pending注文の再利用を確認 |
| E-03 | 同一注文の重複通知 | BLOCKED | 同一test eventの再配送で状態と権限が重複しないことを確認 |
| E-04 | 非公開作品への直接アクセス | BLOCKED | 未購入・非所有アカウントで404または拒否を確認 |
| E-05 | 販売停止商品の購入防止 | BLOCKED | `paused`へ戻した後、Sessionを作成できないことを確認 |
| E-06 | 他人の購入ファイルへのアクセス拒否 | BLOCKED | Buyer AのdownloadをBuyer Bが取得できないことを確認 |
| E-07 | Readerの権限確認 | BLOCKED | 未購入、購入者、所有者の3主体で比較 |
| E-08 | PDF download失敗 | BLOCKED | Storage取得失敗を安全に再現できる隔離fixtureを使用 |
| E-09 | スマートフォン操作 | BLOCKED | 390x844相当で検索、詳細、試読、Checkout復帰、本棚、Readerを確認 |

過去のStaging決済失敗／返金E2E証跡は参考にしますが、2026-10-09の最新環境結果として流用しません。

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

さらにMarketplace名を含む38 test fileを標準のTypeScript stripping付きで一括実行し、`PASS 183 / FAIL 0 / SKIPPED 0`でした。Hub全体は`PASS 1267 / FAIL 0 / SKIPPED 0`、Hub／Desktop型検査、全lint、migration 96件検証、依存境界、Production build、`git diff --check`も成功しています。依存境界は既知warning 2件、新規error 0件です。

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
9. E-01からE-09を、正常系の証跡を壊さない順で実施する。
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
6. 完了: strict preflight 3/3、fixture監査8/8を成功させた。次はこの文書のS-01から認証済み実E2Eを開始する。

### 12.1 2026-10-09 Preview設定結果

- Supabase Preview Branch `marketplace-e2e-20261009`を接続先とし、親Productionとは異なるBranchであることを確認した。
- Supabase URL、anon key、service-role key、Preview／親ref、`MANGAI_DB_ENV=staging`、Checkout mode `test`の7件はVercel Preview専用で、git branch限定なし。
- anon／service-role JWTは値を出力せず、roleとproject refだけを対象Branchと照合した。
- Vercel Production、Production DB／Storage、Stripe、Webhook、fixture、注文、決済、公開・販売は変更していない。
- strict runtime preflightはSupabase isolation、Checkout mode、Stripe test credentialsの3/3が`READY`。Sensitive値を取得できない場合はPreview限定metadataで判定し、明示的なlive keyは拒否する。
- PR #629のPreview deploymentは`Ready`で、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsはすべて成功した。

これらは外部設定またはStagingデータ変更を伴うため、対象環境と変更内容を示した実行時承認後に行います。
