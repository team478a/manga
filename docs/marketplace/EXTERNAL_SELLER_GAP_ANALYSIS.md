# 外部作品持ち込み出品 Gap Analysis

- 作成日: 2026-10-09
- 対象: `team478a/manga`
- 基準: `origin/feature/manga-canvas-mvp` @ `8032a06a2a113508ec2e18de249689053f226340`
- 状態: `ANALYSIS_COMPLETE / DESIGN_ONLY / PRODUCTION_NOT_CHANGED`
- 対象範囲: 一般向けMarketplace。成人向けMarketplaceは対象外。

## 1. 結論

MANGAI以外で完成した漫画を、販売用ファイルだけ登録してMarketplaceへ掲載する経路は一部存在する。しかし、漫画本文を安全に取り込み、ページ順・試し読み・固定版・審査・Reader閲覧まで一貫して保証する「持ち込み出品」機能は未実装である。

既存の `works`、`digital_products`、Checkout、注文、購入権限、本棚、Reader、読書進捗、購入ファイル取得は再利用できる。最小変更案は、外部作品用の申請・ページ取り込みモデルを追加し、既存の固定版Publicationを後方互換で一般化することである。新しい販売基盤やReaderを別実装しない。

外部出品MVPの前提は次のとおり。

1. アップロード直後は隔離領域に置き、作品・商品を公開または販売中にしない。
2. ファイル実体、ページ数、画像寸法、展開サイズ、重複、マルウェアを検証する。
3. 検証済みページから不変のPublicationを作る。
4. 権利申告と管理者審査を完了するまで公開・販売をDBでも拒否する。
5. 承認後は既存のMarketplace、Checkout、購入権限、Reader、ダウンロードを利用する。
6. 管理者がMarketplace掲載と販売を即時停止できるようにする。

## 2. 調査方法と境界

最新コードとmigrationを読み取り専用で確認した。Production DB、Production環境変数、Storage object、公開状態、販売状態、注文、決済、Provider、creditは変更していない。

主な確認箇所:

- `src/app/actions/work-actions.ts`
- `src/app/actions/product-actions.ts`
- `src/app/actions/shared/file-validation.ts`
- `src/app/actions/shared/storage-transaction.ts`
- `src/app/dashboard/works/new/page.tsx`
- `src/app/dashboard/products/new/page.tsx`
- `src/app/api/creator/projects/import/route.ts`
- `src/modules/cloud-creator/import/import-service.ts`
- `src/modules/cloud-creator/assets/asset-service.ts`
- `src/lib/cloud-asset-upload.ts`
- `src/lib/cloud-marketplace.ts`
- `src/modules/publication/application/work-publication-service.ts`
- `src/modules/publication/domain/work-publication-access.ts`
- `src/lib/checkout.ts`
- `src/lib/purchases.ts`
- `src/app/admin/products/page.tsx`
- `src/app/dashboard/sales/page.tsx`
- `supabase/schema.sql`
- `supabase/migrations/202607180001_content_class_boundary.sql`
- `supabase/migrations/202608140004_cloud_work_publications.sql`
- `supabase/migrations/202609280001_marketplace_static_seed.sql`
- `supabase/migrations/202609290001_cloud_marketplace_listing_publish.sql`
- `supabase/migrations/202609290002_cloud_marketplace_listing_withdrawal.sql`

## 3. 既存実装の再利用可能範囲

### 3.1 そのまま再利用できるもの

- `works`: タイトル、説明、表紙、一般向け分類、公開状態、作者を保持できる。
- `digital_products`: 価格、販売ファイル、販売状態、作者を保持できる。
- Marketplace一覧・作品詳細・作者表示・あとで読む。
- Checkout、Stripe test/live境界、注文冪等性、決済Webhook処理。
- 購入者の本棚、購入ファイルの短時間署名URL。
- Publicationを参照するReader、試し読み、購入権限、続きから読む。
- creator owner isolation、一般向けcontent boundary、既存RLSの考え方。
- Cloud Assetの画像実体検証、SHA-256、owner path、quota、保存失敗時rollbackの実装パターン。
- Cloud Marketplaceの「固定版を作ってから公開する」RPCと公開・取下げのトランザクション設計。

### 3.2 条件付きで再利用するもの

`cloud_work_publications` と `cloud_work_publication_pages` はReaderが利用できる完成版モデルだが、現在は `cloud_projects` と `cloud_project_checkpoints` の外部キーが必須である。外部作品を偽のCloud Projectとして登録する案は、監査・所有権・削除ライフサイクルを混同するため採用しない。

最小変更は、既存テーブル名とCloud RPCを維持したまま次を追加することである。

- `source_kind in ('cloud','external')`
- `external_submission_id`
- Cloudでは `project_id` と `checkpoint_id` を必須、Externalでは `external_submission_id` を必須とするCHECK制約
- 外部固定版を原子的に生成する専用RPC

これによりReader、試し読み、購入権限、読書進捗の既存実装を継続利用できる。将来の大規模整理ではテーブル名を `work_publications` に変更できるが、MVPでの全面renameは不要である。

### 3.3 再利用してはいけないもの

- Desktop JSON manifest importを、任意PDF・ZIP・画像の検証済み取り込みとみなさない。
- `manga-quality` の権利確認をMarketplace審査として流用しない。用途・責任主体・監査証跡が異なる。
- ブラウザ申告のMIME typeだけで販売ファイルを安全とみなさない。
- 手動作品登録の即時公開と手動商品の即時activeを、外部出品の承認済みフローとして扱わない。
- ローカルFilesystem／SQLite前提のSales Package処理を、そのままServer処理へ移植しない。

## 4. 機能別Gap

工数は1名の実装・テスト日数の概算で、法務確認、運用訓練、審査待ち時間、外部サービス契約を含まない。

| 項目 | 現状 | 再利用 | 不足 | 対応方針 | 優先度 | 工数 | リスク |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PDFアップロード | 商品用PDFは50MBまで登録できるが、本文ページとして解析しない | private `digital-products` bucket、owner path、rollback | magic bytes、破損、暗号化、ページ数、寸法、埋込要素、マルウェア検査 | quarantineへ保存し、workerでPDF解析・ページ画像化・hash記録後だけreadyへ遷移 | P0 | 5〜8日 | PDF parser脆弱性、巨大画像、処理時間、個人情報 |
| ZIPアップロード | 商品用ZIPは登録可能だが、中身を展開・検証しない | upload transaction、private Storage | path traversal、zip bomb、拡張子偽装、順序、混在形式 | entry数・展開後総量・圧縮率・pathを制限し、画像だけを隔離展開 | P0 | 4〜7日 | zip bomb、悪性ファイル、Storage枯渇 |
| 画像アップロード | 表紙は実体検証済み。Cloud assetにも実体・寸法検証がある | `sharp`検証、Cloud asset quota/hash | 複数本文画像、連番、重複、ページ上限、一括失敗復旧 | 複数画像をsubmission単位で保存し、100ページ上限、hash重複検出、原子的ready化 | P0 | 4〜6日 | decompression bomb、EXIF、色空間、極端寸法 |
| ページ分割 | Cloud完成版ではページが既に確定。外部PDFの分割なし | Publication page、export image処理のパターン | PDF→画像変換、失敗ページ、再実行、timeout | idempotent ingest jobを追加し、ページ単位状態と固定error codeを記録 | P0 | 4〜7日 | 二重処理、部分成功、worker負荷 |
| ページ並び替え | Publicationはpage_number順。外部用編集UIなし | Publicationの連番検証 | draft順序、欠番、確定後変更禁止 | `external_submission_pages.position`をdraft時だけ更新し、固定版作成時に1..Nを検証 | P0 | 2〜4日 | 競合更新、ページ欠落、誤順序 |
| 表紙設定 | 手動作品のJPG/PNG/WebP表紙、Cloud完成版表紙がある | `validateWorkImage`、`works` bucket | 本文1ページ目採用、切り出し、審査前公開防止 | 検証済み本文から候補生成または別画像。公開URLは承認後に限定 | P1 | 2〜3日 | 審査前情報露出、縦横比、著作権 |
| Publication変換 | Cloud専用固定版とページ、連続性検証あり | Publication、page、Reader、sample flag | Cloud Project/Checkpoint必須、外部用manifest | source_kindを後方互換追加し、submission→publication RPCを実装 | P0 | 5〜8日 | 既存Cloud作品回帰、FK移行、固定版不変性 |
| Reader統合 | 公開・所有・購入・sampleで権限分岐し、署名URLを返す | publication service/access | 外部作品の固定版が存在しない | 外部固定版を既存Readerへ渡し、権限ルールは変更しない | P0 | 2〜4日 | 有料本文漏えい、古い版の混在 |
| 試し読み設定 | Publication pageに`is_sample`があり、未購入者はsampleのみ閲覧 | 既存Readerと公開詳細 | 外部用選択UI、最低/最大規則、0件防止 | 固定前にページ選択。最低1、上限は総ページ数・運用規則で制限 | P0 | 2〜3日 | 全ページ無料化、試し読みなし、順序混乱 |
| 出品者登録 | profile roleはbuyer/creator/adminのみ。専用seller状態、本人確認、規約同意なし | `profiles`、認証、owner isolation | eligibility、規約version、停止、確認履歴 | `seller_profiles`を追加し、draft/eligible/suspended。MVPは招待制・管理者承認 | P0 | 4〜6日 | なりすまし、規約未同意、停止漏れ |
| 権利申告 | Marketplace専用の権利申告・証跡なし | 認証profile、監査時刻の設計パターン | 権利者、AI利用、第三者素材、成人向け否認、規約version | immutableな宣誓snapshotとチェック項目をsubmissionに紐づける | P0 | 3〜5日 | 虚偽申告、法的対応、証跡改変 |
| 審査ワークフロー | Marketplace用申請・承認・差戻しなし | admin認証、既存状態機械の実装パターン | 状態、理由code、担当者、履歴、再申請 | draft→submitted→in_review→approved/rejected。履歴append-only | P0 | 5〜8日 | 権限昇格、状態飛越、個人判断の不一致 |
| 管理者公開停止 | 商品一覧は読み取り専用で、停止操作なし | admin一覧、withdrawの考え方 | 強制停止、理由、再開承認、通知、監査 | admin専用RPCで商品paused→作品非公開を原子的に実行し監査logを残す | P0 | 3〜5日 | 誤停止、停止漏れ、購入済み利用者への影響 |
| 商品・価格管理 | creatorが商品を作成しactiveにできる。価格は0以上。Cloud publish RPCは完成版を検証 | `digital_products`、Cloud publish/withdraw RPC | 外部審査gate、MVP価格上限、一作品一商品保証 | 作成時paused固定。approved publication一致時だけ専用publish RPCでactive化 | P0 | 3〜5日 | 審査迂回、不正価格、販売ファイル差替え |
| Checkout | active・公開・一般向けを確認し、注文とStripe境界あり | Checkout、order、Webhook冪等性 | 外部承認状態の条件 | 商品active化を専用RPCに閉じ、Checkoutにもapproved publicationを防御的確認 | P0 | 2〜4日 | 審査後差替え、重複注文、test/live混同 |
| 購入権限 | paid orderとpublicationでReader権限を判定し、ファイルを署名URLで提供 | 本棚、purchase access、署名URL | 外部固定版との関連 | Publication一般化後も既存ルールを使用。購入時publication versionを固定する案を検討 | P0 | 2〜4日 | 販売後の版差替え、他人のfile access |
| 売上・手数料 | paid live注文の売上・20%手数料・受取予定額を表示 | `orders`、creator sales query | 税区分、取消調整、確定台帳、CSV | MVPは参考表示を維持し、精算対象外を明示。確定台帳は後続 | P1 | 2〜4日 | 会計差異、返金反映、税込表示 |
| 精算・送金 | MANGAIからの振込・精算確定は未提供。Stripe Connectも未実装 | 注文のcreator_revenue | 本人確認、口座、締め、留保、返金控除、送金、帳票 | 外部出品MVPと分離。Stripe Connect等を法務・会計と設計後に実装 | P2 | 15〜30日以上 | 資金決済、税務、KYC、チャージバック |
| 監査・通知 | 一部機能に状態・ログ・メールがあるが、外部審査専用ではない | sanitize logger、通知基盤のパターン | 誰が何を承認・停止したか、利用者通知 | append-only eventと固定reason code。秘密値・作品本文をlogに残さない | P0 | 3〜5日 | 個人情報、監査欠落、通知誤送信 |

## 5. 現行フローで確認した安全上のGap

### 5.1 手動作品がPublicationを迂回できる

`createWork` は `source_project_id` のない作品を公開状態で作成できる。`updateWork` とDB triggerも、完成版Publicationを要求するのはCloud連携作品だけである。

### 5.2 手動商品が審査を迂回できる

`createDigitalProduct` は手動作品に対して初期状態をactiveにできる。Cloud連携作品だけにPublication gateが適用され、権利申告・審査承認は条件に含まれない。

### 5.3 販売ファイル検証がMIMEとサイズのみ

表紙画像は実体を確認するが、商品PDF・ZIP・画像はブラウザ申告MIMEと50MB上限だけである。持ち込み本文の安全な解析には不足する。

### 5.4 Storage policyがprofile ownerを直接照合しない経路がある

`works` bucketのmigration policyは、一般向けprefixとauthenticated roleを確認するが、先頭folderをauth user IDと照合する形ではない。アプリ側owner pathだけに依存せず、外部取り込み用bucketはDBに登録したsubmission ownerと一致する署名済みuploadか、server-side uploadだけに限定する。

### 5.5 管理者停止と精算が未提供

管理商品画面は読み取り専用であり、公開停止操作を行わない。売上画面の受取額は参考値で、送金・精算確定はない。外部出品の一般募集前に、少なくとも公開停止はP0として必要である。

## 6. 推奨データモデル

### 6.1 新規テーブル

`external_seller_profiles`

- `profile_id`
- `status`: `draft | eligible | suspended`
- `terms_version`、`terms_accepted_at`
- `approved_by_profile_id`、`approved_at`
- `suspension_reason_code`

`external_work_submissions`

- `id`、`owner_profile_id`
- `status`: `draft | uploading | validating | ready | submitted | in_review | approved | rejected | published | paused`
- `title`、`description`、`age_rating`
- `source_format`: `pdf | zip | images`
- `rights_declaration_version`、`rights_declared_at`
- `reviewed_by_profile_id`、`reviewed_at`、`review_reason_code`
- `work_id`、`product_id`、`publication_id`
- optimistic lock用`version`

`external_work_submission_pages`

- `submission_id`、`position`
- quarantineとvalidatedのStorage path
- `sha256`、`width`、`height`、`byte_size`
- `validation_status`、固定`error_code`
- `is_sample`

`external_work_submission_events`

- append-onlyの状態変更、actor、固定reason code、時刻
- 作品本文、メール、秘密値、生例外は格納しない

### 6.2 既存テーブルの後方互換拡張

`cloud_work_publications`

- `source_kind`を追加し、既存行は`cloud`
- `project_id`と`checkpoint_id`をnullable化
- `external_submission_id`を追加
- Cloudはproject/checkpoint必須、Externalはsubmission必須の排他的CHECK
- `work_id, version`とページ連続性は維持

`works`

- `source_kind`または`external_submission_id`を追加
- 外部作品がpublic/publishedになる条件にapproved publicationを追加

`digital_products`

- 外部作品がactiveになる条件にapproved publication、価格範囲、販売ファイル一致を追加

## 7. 推奨MVPフロー

1. 招待済みcreatorが外部出品者規約へ同意する。
2. 非公開submissionを作成する。
3. PDF／ZIP／画像をquarantineへアップロードする。
4. workerが実体・安全性・ページ構成を検証する。
5. 利用者がページ順、表紙、作品情報、価格、試し読みを確認する。
6. 権利申告をsnapshot化して審査申請する。
7. 管理者が本文・表紙・説明・権利申告を確認し承認または差戻す。
8. 承認RPCが検証済みページから固定版Publication、paused商品、draft作品を原子的に作る。
9. 出品者の最終確認後、専用publish RPCが作品公開と商品activeを原子的に実行する。
10. 既存Marketplace、Checkout、本棚、Reader、ダウンロードを利用する。
11. 異常時は管理者停止RPCで商品pausedを先に確定し、作品を非公開化する。

## 8. 実装PRの分割案

### PR-1: 安全な申請基盤（P0）

- seller eligibility、submission、rights snapshot、event log
- RLSと状態遷移RPC
- 手動公開・active経路から外部出品を分離
- Migration rollbackと権限テスト

### PR-2: 隔離アップロードと検証worker（P0）

- PDF／ZIP／複数画像
- quarantine、quota、magic、展開上限、hash、malware hook
- ページ分割・順序UI
- idempotency、lease、retry、cleanup

### PR-3: Publication一般化とReader統合（P0）

- 後方互換migration
- external fixed publication RPC
- sample pages、Reader entitlement、購入時version固定の検討
- Cloud既存作品の回帰テスト

### PR-4: 審査・公開・強制停止（P0）

- 管理者審査UI、承認／差戻し
- 専用publish／withdraw／admin stop RPC
- 通知と監査証跡
- Checkout防御条件

### PR-5: 売上運用（P1）

- 税込表示、返金反映、CSV、運用レポート
- 精算・送金は含めない

## 9. 必須セキュリティテスト

- owner Aがowner Bのsubmission、page、publication、販売ファイルを読めない・更新できない。
- anonがquarantine、validated pages、購入ファイルへアクセスできない。
- 未購入者がsample以外の署名URLを取得できない。
- 拡張子偽装、破損PDF、暗号化PDF、zip traversal、zip bomb、画像bombを拒否する。
- upload中断、worker timeout、retry、同一job重複起動で二重Publicationを作らない。
- 審査前・差戻し・停止中の商品をactiveにできない。
- 承認後に本文・表紙・価格・販売ファイルを差し替えた場合は再審査または公開拒否になる。
- 一般向けで成人向けcontentを選べず、既存adult領域へ影響しない。
- Stripe test/liveが混在せず、Webhook重複でも注文を重複確定しない。
- 販売停止後は新規購入不可、既存購入者の権利方針は仕様どおり維持される。
- 管理者操作はadmin以外に実行できず、監査eventが残る。

## 10. 受入条件

外部出品MVPを一般募集へ出す前に、少なくとも次を満たすこと。

- 招待済みsellerだけが申請できる。
- PDF、ZIP、画像の安全な取り込みとページ順確認ができる。
- 作品は審査承認前に公開・販売されない。
- 権利申告と審査履歴が監査可能である。
- 完成版Publicationが固定され、Readerでsample／購入本文の境界が守られる。
- Checkout、購入、本棚、続きから読む、購入ファイルdownloadがテスト決済で完了する。
- 管理者が即時に販売停止できる。
- owner isolation、RLS、Storage access、idempotencyの自動テストがある。
- 既存Cloud作品の公開・販売・Readerに回帰がない。
- Production migration、公開、販売、決済は個別の明示承認後に行う。

## 11. 概算と推奨優先順位

- P0外部出品MVP: 30〜50実装日程度。安全な取り込み、審査、Publication、公開停止を含む。
- P1運用改善: 6〜12実装日程度。表紙支援、売上CSV、運用レポート等。
- P2精算・送金: 15〜30実装日以上に加え、法務・会計・KYC・外部サービス契約が必要。

最初の提供範囲は「招待制・一般向け・100ページ以下・PDF/ZIP/画像・1作品1商品・管理者審査あり・送金機能なし」が妥当である。一般公開募集と成人向け対応は、MVPの監査・停止・権限E2Eが安定した後の別工程とする。

## 12. 承認が必要な後続操作

- Phase Cは調査・設計のみで完了。DB、Storage、Production設定は変更していない。
- 新規migration、RLS、bucket、worker、管理者操作を実装する場合は別PRに分ける。
- Production migration適用、外部作品upload、作品公開、販売開始、Stripe決済、管理者停止の実地確認は、それぞれ対象・停止条件を示した実行時明示承認を得る。
- 成人向けMarketplaceへ波及する変更は、この設計から分離して別承認とする。

## 13. 検証結果

- 既存Marketplace／Publication／Storage／Checkout関連: 61/61 PASS
- Hub全テスト: 1262/1262 PASS
- Canvas: 26/26 PASS
- AI: 50/50 PASS
- Desktop: 407/407 PASS
- Supabase migration静的検証: 96/96 PASS
- Hub TypeScript型検査: PASS
- ESLint: PASS
- 依存・module境界: error 0、既知warning 2
- Hub Production build: PASS
- Desktop build: PASS（既存のchunk size warningあり）
- Desktop accessibility: violation 0（自動判定不能の既存color contrast項目は手動確認対象）
- `git diff --check`: PASS

実環境への外部作品upload、審査、公開、販売、決済は機能未実装のため未実施であり、PASSとは報告しない。
