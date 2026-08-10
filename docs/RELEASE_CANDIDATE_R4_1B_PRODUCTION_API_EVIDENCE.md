# MANGAI PR-R4-1b Production API追加受入れ証跡

最終更新: 2026-08-10

状態: `PARTIAL_EXTERNAL_CONFIGURATION_REQUIRED`

対象branch: `codex/release-r4-1b-production-api-acceptance`

基準commit: `7a304834fd1ccea553590f922f132b4d99b7be01`（PR #218 merge commit）

Draft PR: [#219](https://github.com/team478a/manga/pull/219)

## 1. 判定

責任者のproduction利用承認に基づき、一般向けCloud漫画制作で実Providerを1件だけ呼び出した。BFL画像生成、課金予約、Worker実行、private Asset、Canvas配置、自動保存、再読込、1ページPNGは成功した。

R4-1全体は完了扱いにしない。市場分析の対象利用者session、OpenAI文章生成、作品バックアップmigration、Scheduler、8ページPDF、2利用者owner isolation、Stripe test E2Eが未完了である。

本受入れではapplication code、DB、migration、RPC、Storage設定、API、URL、Feature Flag、Provider、model、pricing、retry、timeout、Scheduler、Canvas schema、PDF／PNG仕様、成人向け境界、Stripe、Desktop codeを変更していない。

## 2. Production実行範囲

- production domain `https://app.mang-ai.com`の既存管理者sessionを使用した。
- 検証用の既存一般向け作品に1ページを追加した。削除は行っていない。
- 一般向け・非人物の背景画像を1件だけ生成した。Prompt本文、生成画像、Job ID、利用者識別子は証跡へ残さない。
- Schedulerが未設定のため、管理画面の「待機中Jobを1件実行」を1回だけ使用した。
- 作品バックアップは作成要求だけを行い、migration不足で失敗したためcheckpointは作成されていない。
- OpenAI文章生成は登録要求だけを行い、Job作成前に拒否された。Provider呼出し、予約、課金は発生していない。

## 3. BFL画像生成・保存・PNG

| 確認 | 結果 |
|---|---|
| Queue登録 | PASS。background Jobが`queued / 0%`となった |
| Credit予約 | PASS。使用2／予約2／残り16 |
| Worker | PASS。管理画面で1件完了、待機0／実行中0 |
| Provider | PASS。BFL `flux-2-pro`で`completed / 100%` |
| Cost settlement | PASS。実コスト`$0.0300`、予約`$0.0000` |
| Credit確定 | PASS。使用4／予約0／残り16 |
| Failure | PASS。直近24時間0件。3件の過去失敗は既存data |
| Asset | PASS。生成画像がprivate Assetと候補一覧へ表示された |
| Canvas採用 | PASS。新規コマへAI背景layerとして配置した |
| 永続化 | PASS。自動保存後の再読込でコマとAI背景layerを確認した |
| PNG | PASS。画面に「PNGを書き出しました。」と表示された |

既存作品はAIシナリオから採用したネームの系譜を持たないため、2〜4候補のコマ生成は「本人の作品・採用ネームが必要」という既存契約で安全に拒否された。この条件を迂回していない。

## 4. Productionで判明した未解決事項

### 4.1 作品バックアップmigration不足

「バックアップを作成」を実行すると「作品バックアップ用migrationを適用してください。」となった。repository上の対応migrationは`202608010011_cloud_project_checkpoints.sql`であり、`create_cloud_project_checkpoint(uuid,text,text)`が存在しない時の既存エラー表示と一致する。

本番DBへmigrationは適用していない。対象Supabase projectでmanifestとの差分を確認し、依存順どおりに未適用migrationを適用してから、checkpoint作成・差分・復元を再受入れする。

### 4.2 同一タブ再読込後の編集ロック待機

Canvas自動保存後に同じページを再読込すると、一時的に「このページは別の画面で編集中です」となった。同一タブで作品画面へ戻り、同じページへ再入場した場合にも再現した。lease期限後は自動的に編集可能へ戻り、保存済みコマとAI背景layerは保持されていた。

データ損失は確認していないが、通常の再読込で最大約2分編集できない操作性問題として、R4受入れ記録とは分離した小さな修正PR候補にする。

追補: PR #220を`d40d8d4f4e30ff57fcb160f7842afb7b780069d5`でマージ後、同一タブ再読込／再入場の即時復帰と別タブ排他をProductionで再受入れし、本項目は解決した。詳細は[`RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md`](RELEASE_CANDIDATE_R4_1C_PAGE_LOCK_EVIDENCE.md)を参照する。

### 4.3 Cloud Editor文章Jobの登録前拒否

一般向けの短いセリフ生成を1件要求したが、「登録に失敗しました。」となり、Jobは作成されなかった。使用4／予約0／残り16のままで、OpenAI呼出しと課金は発生していない。

管理画面のOpenAI設定とCloud Editorのtext Gateway capabilityは別経路である。productionのGateway／Feature Flag／pricingのどの条件が不足したかは画面証拠だけでは断定せず、秘密値非表示のreadiness確認後に再実行する。

## 5. 市場分析

現在の管理者sessionで市場分析を送信すると、Provider呼出し前に一般モニター利用権限で拒否された。管理画面では、対象利用者の一般モニター状態がactiveで利用7／上限50と確認できたが、その利用者sessionへログインできないため、対象利用者自身の保存・一覧・再読込は未確認である。

招待完了と一般モニターenrollmentは区別して扱い、管理者へ一時的な利用権限を付与したり、対象利用者の認証情報を要求したりしていない。

## 6. 残件と再開順

1. 対象Supabase projectでmigration manifestを照合し、少なくとも`202608010011_cloud_project_checkpoints.sql`の未適用を解消する。
2. production Cloud text Gatewayのenabled、model、pricingを秘密値非表示で照合し、Jobを1件だけ再受入れする。
3. 編集ロックの同一タブ再読込問題を別Draft PRで修正し、二重編集防止を維持した回帰試験を行う。
4. 対象一般モニター本人のsessionで市場分析の保存・一覧・再読込・フィードバック送信を確認する。
5. AIシナリオから採用した8ページ以上のtest作品で、候補比較・採用・再生成・画像編集・一括生成・checkpoint・復元・PDFを確認する。
6. Scheduler設定、2利用者owner isolation、Stripe test E2Eを完了する。

上記が揃うまで`hub-production-acceptance`とR4-1はpendingを維持し、R4-2へ進まない。

## 7. 自動検証

| 検証 | 結果 |
|---|---|
| `npm run rc:acceptance` | PASS。2 passed／11 pending／2 blocked、schema valid |
| `npm run cloud:manga:acceptance:repo` | PASS |
| `npm run db:migrations:validate` | PASS。50 migrations／rollbacks |
| `npm run rc:validate` | PASS。Desktop 182/182、Hub 620/620、Hub production build、migration validation |
| `git diff --check` | PASS |

最初の`rc:validate`ではDesktop統合テストが181/182となった。Desktop単独再実行で182/182、その後の全`rc:validate`再実行で182/182を含めて完走したため、一時的なテスト揺らぎとして記録する。

## 8. Rollback

- 本PRは文書だけのため、commitのrevertで戻せる。
- productionに追加した検証ページ、Asset、Canvas layerは本番test dataとして残す。削除は破壊的操作になるため、本PRでは行わない。
- 実Provider設定、pricing、credit、DB、Storage、Schedulerは変更していないため、設定rollbackは不要。
