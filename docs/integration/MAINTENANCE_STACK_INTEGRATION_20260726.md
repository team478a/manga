# 保守性改善PR #14〜#28 統合記録（2026-07-26）

## 1. 統合元デフォルトブランチと開始コミット

- 統合元: `feature/manga-canvas-mvp`（最新、PR #30〜#32適用済み）
- 開始コミット: `c99a96b172fd1b45c8e8b3c4f4b2417347a0e62e`（`Merge pull request #32 from team478a/codex/creator-workflow`）
- 統合作業ブランチ: `integration/maintenance-stack-20260726`（上記コミットから新規作成）
- **Code integration HEAD**: `a58dc66`（`add hub structured logging`、PR #28相当。保守性改善PR #14〜#28のcherry-pickが完了した時点で、コード変更はここまで）
- **Final branch HEAD before this correction**: `43cee0f1f42d4c68e697559aa0422b9e3fd9c418`（`a58dc66`の上に統合記録文書・引継ぎ文書を追加した時点。コード変更なし、文書追加のみ）
- Draft PR: **#34**（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`）、PR state: Draft / mergeable、Changed files: 139 files

`feature/manga-canvas-mvp`は、保守性改善stackの分岐元（`27d678b`）から6コミット進んでいた（PR #30: Vercel workspace package build修正、PR #31: パスワード確認・再設定フロー、PR #32: Creatorプロフィール・作品アップロードの安全性強化）。本統合はこれらを失わずに保守性改善PR #14〜#28を取り込むことを目的とした。

## 2. 統合したPR #14〜#28一覧

| PR | 内容 | 元コミット |
| --- | --- | --- |
| #14 | Desktop SQLite Migration Runner集約 | `da218d2eaf21bf2a9495b99278575a3a54564141` |
| #15 | Desktop Database facade、Asset/Backup分離 | `9c0e71b5f9d29566943cfa1c42ab40d72bacb780` |
| #16 | Desktop AI Queue/Policy分離 | `b62df63f6eb24afb648e809655379ea40b58ef63` |
| #17 | Cloud Canvas Editor hook/service分離 | `cd187d5e1f914c1895e16de06377d484107f4593` |
| #18 | Cloud Creator Serverモジュール分離 | `e3953558c1c728319e72f9d7e4f40e8bc6f8e84e` |
| #19 | Hub Server Action分割・Storage補償transaction | `1c9e92d5e0bd21828db37f2a01c90994e9b8aaa9` |
| #20 | Package公開API・依存境界検査 | `f08b56ebdc868c39bb1f51f3baa30ced7723d3f6` |
| #21 | Cloud Canvas Domain Error契約 | `8dff36566cc783c31e4d804f516876be9d0578f7` |
| #22 | Cloud AI Domain Error契約 | `4ddf5a6e719c40d996a3ff57430c99e95b34b2fb` |
| #23 | Cloud Structure Domain Error契約 | `69635994eb3ba9c0e55c4ba8d143baca4a7f0ee2` |
| #24 | Cloud Project/Asset Domain Error契約 | `7cbacafccf858bc05f4a3f412f92cb831e2314fe` |
| #25 | Checkout/Billing/Desktop Domain Error契約 | `62c36fdce11da0ef50c573067b51d46357ba7392` |
| #26 | Stripe Webhook/購入download Domain Error契約 | `2afd52eac6165ef8e5210c9d95144da97998f043` |
| #27 | Hub Server Action Domain Error契約 | `04ee3310a621d7aa54af996df8b3c363a0c5d45a` |
| #28 | Hub Structured Logging、request相関ID | `0910919e37904245b80e26e4c495893da6234a9e` |

全15件を古い順（#14→#28）に1コミットずつ`git cherry-pick`した。一括cherry-pickは行っていない。

## 3. cherry-pickしたコミット一覧（新ブランチ上のコミットハッシュ）

```text
0c90c28 refactor(desktop): centralize sqlite migrations              (PR #14)
291f2f2 refactor(desktop): separate asset and backup services        (PR #15)
99ce696 refactor(desktop): separate ai queue and policy services     (PR #16)
d202482 refactor cloud canvas editor modules                         (PR #17)
ec96d83 refactor cloud creator server modules                        (PR #18)
38f06df refactor server actions and storage rollback                 (PR #19, 競合解決あり)
c422c09 enforce package dependency boundaries                        (PR #20, 競合解決あり)
ffdb719 introduce typed cloud canvas errors                          (PR #21)
fc34b6f type cloud ai service and worker errors                      (PR #22)
3b8d03c type cloud structure errors                                  (PR #23)
2bf00c2 type cloud project and asset errors                          (PR #24)
8dfa6a3 type checkout billing and desktop errors                     (PR #25)
e46f1cc type webhook and purchase download errors                    (PR #26)
008a19c type hub server action errors                                (PR #27, 競合解決あり)
a58dc66 add hub structured logging                                   (PR #28)
```

各コミット後に`git status --short`と`git diff --check`を確認し、cherry-pick自体が生成した不要な差分（空白警告等）がないことを確認した。

## 4. 発生した競合

3件のコミットで競合が発生した。すべて`src/app/actions.ts`系ファイルまたは`package.json`。それ以外の12コミットは無競合で適用された。

| 競合コミット | 競合ファイル |
| --- | --- |
| PR #19（`1c9e92d`） | `src/app/actions.ts` |
| PR #20（`f08b56e`） | `package.json` |
| PR #27（`04ee331`） | `src/app/actions/auth-actions.ts`、`src/app/actions/profile-actions.ts`、`src/app/actions/work-actions.ts` |

## 5. 競合ごとの解決内容

### 5.1 PR #19（`src/app/actions.ts`）

**背景**: `feature/manga-canvas-mvp`側（PR #31/#32）は、分割前の822行の`actions.ts`へパスワード確認付きsignUp、`requestPasswordReset`/`updatePassword`、`profileInputSchema`によるプロフィール検証強化、`workInputSchema`+sharpによる画像形式検証+旧画像Storage削除を追加していた。保守性改善側（PR #19）は同じ606行時点の`actions.ts`を機能別ファイル（`src/app/actions/*.ts`）へ分割し、`actions.ts`を69行の薄い互換entrypointへ縮小していた。

**方針**: 分割構造を採用し、`feature/manga-canvas-mvp`側の新機能をすべて対応する機能ファイルへ移設した。

- `src/app/actions/auth-actions.ts`: `passwordSchema = z.string().min(8)`とpasswordConfirmation照合を`signUp`へ追加。新規`requestPasswordReset`・`updatePassword`・`requestOrigin`ヘルパーを追加。Supabaseの生エラーを露出しない安全なメッセージ設計を維持。
- `src/app/actions/profile-actions.ts`: `profileInputSchema`・`firstValidationMessage`によるサーバー側の表示名・自己紹介の必須/文字数検証を追加。DB失敗時のメッセージを、生の`error.message`ではなく固定の安全な文言へ修正（元のPR#19実装は`encodeURIComponent(error.message)`でSupabaseの生メッセージを露出していたため、これも修正）。
- `src/app/actions/shared/file-validation.ts`: `validateWorkImage`を非同期化し、`sharp(...).metadata()`による実画像形式とMIME宣言の一致確認を追加（PR#19の実装は拡張子・MIME文字列のみの検査だった）。
- `src/app/actions/shared/storage-transaction.ts`: 旧画像削除のための`ownedStoragePathFromPublicUrl`（公開URLから所有者パスを検証して導出）と`removeStorageObject`を新規追加。
- `src/app/actions/work-actions.ts`: `createWork`/`updateWork`を`workInputSchema`+`normalizeCreatorTags`+`firstValidationMessage`による検証へ更新。既存の`uploadMarketplaceFile`/`persistWithStorageRollback`（DB保存失敗時の新規Storage object補償削除）は維持しつつ、`updateWork`成功後に`ownedStoragePathFromPublicUrl`+`removeStorageObject`で旧画像を削除する処理を追加。
- `src/app/actions.ts`: 69行の薄い互換entrypointを維持し、`requestPasswordReset`/`updatePassword`の委譲を追加。

**フォーム項目名の確認**: `dashboard/works/new/page.tsx`・`dashboard/works/[id]/edit/page.tsx`を確認し、可視性フィールドは`name="visibility"`（`private`/`public`のradio）のみで、PR#19が参照していた`isPublic`チェックボックスは実在しないことを確認した。`feature/manga-canvas-mvp`側の`visibility`のみを見る実装が実際のフォームと一致するため、これを採用した。

**テストへの影響（機械的な追従、動作は変更なし）**: `tests/auth-recovery.test.mjs`と`tests/creator-workflow.test.mjs`は、分割前の`src/app/actions.ts`のソーステキストを直接正規表現で検査していた。分割構造を採用した結果、これらのテストが検査すべき実装は`src/app/actions/auth-actions.ts`・`src/app/actions/work-actions.ts`・`src/app/actions/shared/file-validation.ts`へ移動したため、検査対象ファイルパスをそちらへ更新した（アサーションの意図・検査内容は変更していない）。これは`tests/server-actions-modules.test.mjs`（PR#19由来、`actions.ts`が100行未満かつ`createClient`/`storage.`/`.from(`を含まないことを要求）と両立させるために必須の追従であり、`actions.ts`をPR#19の互換entrypoint方針のまま維持するために行った。

### 5.2 PR #20（`package.json`）

**背景**: `feature/manga-canvas-mvp`側（PR #30）は`"typecheck": "npm run typecheck:hub && npm --prefix apps/desktop run typecheck"`と`"typecheck:hub": "tsc --noEmit"`（Desktopを含むroot typecheck）を追加していた。保守性改善側（PR #20）は`"typecheck": "tsc --noEmit"`と`"deps:check": "node scripts/check-dependency-boundaries.mjs"`を追加していた。

**方針**: 両方を維持。

```json
"typecheck": "npm run typecheck:hub && npm --prefix apps/desktop run typecheck",
"typecheck:hub": "tsc --noEmit",
"deps:check": "node scripts/check-dependency-boundaries.mjs",
```

他の`scripts`（Hub/Desktop/Canvas/AIテスト、RC関連、migration検証等）はいずれの側も変更しておらず、削除・上書きは発生していない。`packages/*/package.json`（ai-core、canvas-core、export-core、project-core、shared）はPR#20による`main`/`exports`フィールド追加のみで、無競合で自動マージされた。

### 5.3 PR #27（`auth-actions.ts`・`profile-actions.ts`・`work-actions.ts`）

**背景**: PR #27はPR #19が作った分割後のファイルへ型付きDomain Error（`ValidationError`・`PayloadTooLargeError`・`StorageTransactionError`・`safeDomainErrorMessage`）を導入する変更で、PR #19時点の内容をbaseにdiffが作られていた。5.1で追加した新機能（パスワード確認、旧画像削除等）はPR #27には存在しないため、該当箇所でgitの3-way mergeが構造的に一致せず3ファイルで競合した。

**方針**: PR #27のDomain Error型付けを採用しつつ、5.1で追加した新機能を保持する形で手動マージした。

- `auth-actions.ts`: 唯一の競合は`if (error) {...}`の中括弧有無という書式差のみ（機能的に同一）。既存の書式（中括弧あり）を維持。
- `profile-actions.ts`: DB失敗時のメッセージに`encodeURIComponent`を付与する側（PR#27）を採用し、他画面と一貫した形式にした。
- `work-actions.ts`: 2箇所の競合。(1) `createWork`のDB失敗メッセージはPR#27の`encodeURIComponent`付き形式を採用。(2) `updateWork`のDB失敗メッセージはPR#27がより正確な文言「作品を更新できませんでした」（従来は作成と同じ「作品を保存できませんでした」）へ改善していたためこれを採用し、5.1で追加した旧画像削除ロジック（`ownedStoragePathFromPublicUrl`+`removeStorageObject`の呼び出し）をそのまま保持する形で再結合した。

**追加の一貫性調整（コード品質、動作は同一）**: 自動マージ後の`file-validation.ts`で、`@/lib/domain-errors`のimportがファイル末尾に配置されていたため先頭へ移動し、5.1で追加したsharp画像形式検証の例外も他の検証と同様に`ValidationError`型（従来は素の`Error`）へ統一した。`safeDomainErrorMessage`は`DomainError`インスタンスのみメッセージをそのまま表示する設計のため、型を揃えたことで「画像ファイルを確認できませんでした。正しいJPG、PNG、WebPを選んでください。」という具体的な案内が利用者へ正しく届くようになる（従来のプレーンErrorのままだと汎用メッセージへ丸められていた）。

## 6. PR #30〜#32から維持した機能

- **PR #30（Vercel workspace package build修正）**: `package.json`の`"build": "npm run build:packages && next build"`、CI/typecheckのDesktop込みroot構成を維持。Hub production buildが成功することを確認済み。
- **PR #31（パスワード確認・再設定フロー）**: signUpのpasswordConfirmation+8文字以上検証、`requestPasswordReset`（利用者存在を応答へ露出しない設計）、`updatePassword`、`src/app/auth/callback/route.ts`のPKCE callback、`/forgot-password`・`/update-password`画面を維持。いずれも`src/app/actions/auth-actions.ts`へ移設のうえ動作は変更していない。
- **PR #32（Creatorプロフィール・作品アップロードの安全性強化）**: `profileInputSchema`（表示名・自己紹介の上限）、`workInputSchema`（タイトル・説明・タグ上限、タグ正規化・重複削除）、実画像形式とMIME一致確認（sharpメタデータ検査）、DB保存失敗時の新規Storage object削除（既存のStorage補償transactionと統合）、画像差し替え成功後の旧画像削除を維持。いずれも`src/app/actions/profile-actions.ts`・`src/app/actions/work-actions.ts`・`src/app/actions/shared/*.ts`へ移設のうえ動作は変更していない。

## 7. 互換性確認

- `src/app/actions.ts`は69行の薄いasync互換entrypointを維持し、既存importを壊していない（`tests/server-actions-modules.test.mjs`で自動検証）。
- Action名、FormDataフィールド名、redirect先、revalidatePath対象、成功メッセージは変更していない（DB失敗時の安全なエラーメッセージのみ、PR#27の改善に合わせて一部文言を統一）。
- `MangaiDatabase`facade、`apps/desktop/src/main/ai/service.ts`互換entrypoint、`src/lib/cloud-creator-server.ts`互換entrypointはPR#14〜#18の分割後も維持されていることを確認済み（各PRのbody記載の設計方針どおり）。
- Domain Error契約（`src/lib/domain-errors.ts`、`errorCode`）とHub Structured Loggingのredaction仕様（`src/lib/hub-logger.ts`）はPR#21〜#28の内容をそのまま統合し、変更していない。
- Supabase RLS、DB schema、既存migration、Storage path、Stripe metadata、Desktop IPC、SQLite schema、`.mangai-backup`形式には触れていない。

## 8. セキュリティ・安全境界確認

- Supabaseの生エラーメッセージを利用者へ返す既存の問題（PR#19・PR#27の中間状態で一時的に発生していた`encodeURIComponent(error.message)`によるDB生メッセージ露出）は、`feature/manga-canvas-mvp`側の安全な固定メッセージ設計を採用することで解消し、統合後のコードには残っていない。
- Canvas autosave・revision競合処理、AI Generation Router、成人向け・人物画像のfail-closed制御、外部Provider送信前の確認・費用制御には一切触れていない（該当ファイルへの変更はcherry-pick対象コミットの範囲内のみで、いずれもDomain Error型付けや構造分割であり、ロジック・判定条件は変更されていない）。
- パスワード再設定の「利用者の存在を応答へ露出しない」設計（`resetPasswordForEmail`の戻り値`error`を分岐に使わない実装）を維持していることを`auth-actions.ts`で確認した。

## 9. 品質ゲート結果

### 9.1 ローカル実行（2026-07-26、`integration/maintenance-stack-20260726` @ `43cee0f`時点）

| 項目 | 結果 | 詳細 |
| --- | --- | --- |
| `npm install`（root/apps/desktop/packages/canvas-core/packages/ai-core） | PASS | |
| `npm --prefix apps/desktop run build:packages` | PASS | |
| `npm run deps:check` | PASS | 5 packages, 21 source files, 違反0件 |
| `npm run lint` | PASS | エラー・警告なし |
| `npm run typecheck` | PASS | root（Hub）+ Desktop |
| `npm run hub:test` | PASS | **116/116**（旧基準110件から、PR#31/#32由来のauth-recovery・creator-workflowテスト等を含め増加。全件成功） |
| `npm run canvas:test` | PASS | 26/26 |
| `npm run ai:test` | PASS | 44/44 |
| `npm run desktop:test` | PASS | 98/98 |
| `npm run desktop:test:a11y` | **LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT** | 下記10節参照。GUI実行環境（Xサーバー）が本環境にない。GitHub Actions Desktop Windows workflow側の結果は9.2参照 |
| `npm run db:migrations:validate` | PASS | Supabase migration/rollback 16件 |
| `npm run build`（Hub） | PASS | Next.js 16.2.11 production build成功、PR#31由来の`/auth/callback`・`/forgot-password`・`/update-password`ルートを含む |
| `npm run desktop:build` | PASS | |
| `npm run rc:preflight` | PASS（構造チェック） | `Repository structure: READY`。外部サービス設定・手動E2Eは環境依存のためPENDING（想定通り） |
| `git diff --check` | PASS | 空白関連の警告なし |

テスト件数は固定基準（Hub 110、Canvas 26、AI 44、Desktop 98）を下回っておらず、Hub側は増加分を含め全件成功している。以前の固定件数へ戻す調整は行っていない。

### 9.2 GitHub Actions（PR #34、`43cee0f`時点のCI）

| ワークフロー | 結果 | 備考 |
| --- | --- | --- |
| Required Quality（Core quality） | PASS | |
| Migration roundtrip | PASS | |
| Desktop Windows（Windows build） | PASS | Windowsランナー上で`npm run test:a11y`（Accessibility tests）を実行し成功。ローカルのXサーバー不足によるBLOCKEDとは独立して確認できている |
| Vercel Preview | Ready | 状態`success`、"Deployment has completed"（`mangai-hub-staging`プロジェクト） |

Accessibility（axe監査）は、ローカル実行不可のみをもって全体をBLOCKED扱いにしない。GitHub Actions Windows CIでの成功をもって、Accessibility要件自体は満たされていると判断する。

## 10. 未実施の外部環境テスト（BLOCKED_EXTERNAL_ENVIRONMENT）

| 項目 | 状態 | 理由 |
| --- | --- | --- |
| `npm run desktop:test:a11y`（axe監査、ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT | 本コンテナ環境にXサーバー（ディスプレイ）が存在せず、Electronのレンダラープロセスを起動できない（`Missing X server or $DISPLAY`）。診断のため`ELECTRON_DISABLE_SANDBOX=1`を一時的に付与して切り分けたところ、root権限によるsandbox制限ではなくディスプレイ不足が根本原因と判明。コードやテストスクリプトへの変更は行っていない（sandbox設定を緩和する恒久的な変更はセキュリティ境界の緩和にあたるため実施していない）。**GitHub Actions Desktop Windows workflowでは同テストがPASSしており（9.2参照）、Accessibility全体はBLOCKEDではない** |
| Vercel Preview deployment | **PASS**（9.2参照） | PR #34のVercel Preview（`mangai-hub-staging`）は`success`。BLOCKED_EXTERNAL_ENVIRONMENT一覧からは除外し、本番環境の受入れのみ以下に残す |
| Vercel本番環境の通し受入れ | BLOCKED_EXTERNAL_ENVIRONMENT | 本番Vercel/Supabase/Stripe環境へのアクセス権が本環境にない（Previewとは別項目） |
| Supabase staging migration適用 | BLOCKED_EXTERNAL_ENVIRONMENT | staging接続情報・`psql`接続先が本環境に未設定 |
| Stripe test/Webhook実E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Stripe test環境・Webhook endpointの認証情報が本環境にない |
| Windowsコード署名 | BLOCKED_EXTERNAL_ENVIRONMENT | 信頼されたコード署名証明書が本環境にない |
| クリーンWindows install/update E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Windows実機/VMがなく、本環境はLinuxコンテナ |
| Ollama実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | Ollamaサーバー・対象モデルが本環境にない |
| ComfyUI実環境E2E | BLOCKED_EXTERNAL_ENVIRONMENT | ComfyUIサーバー・workflow JSONが本環境にない |
| Dezgo実API E2E | BLOCKED_EXTERNAL_ENVIRONMENT | BYOK APIキー・課金承認が本環境にない |

`db:migrations:validate`（静的検証、16件）は実行・成功済みで、Supabase staging実適用（BLOCKED）とは区別している。

## 11. rollback方法

1. **統合ブランチ全体の取り消し**: `integration/maintenance-stack-20260726`ブランチとそのDraft PRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（本ブランチは`feature/manga-canvas-mvp`へまだmergeしていない）。
2. **個別コミットの取り消し**: 統合ブランチのみで作業を続ける場合、`git revert <commit>`で該当コミットのみを打ち消せる。ただし#19以降は分割構造への依存があるため、#19単体のrevertは#20〜#28のrevertも順に必要になる可能性が高い（stacked構造のため）。
3. **競合解決のみのやり直し**: 3件の競合コミット（`38f06df`＝PR#19、`c422c09`＝PR#20、`008a19c`＝PR#27）は、本ドキュメント5節の方針に従って`git cherry-pick`をやり直せば再現できる。元のPRブランチ（`codex/pr-14-actions-storage-transactions`等）は変更していないため、必要なら`integration/maintenance-stack-20260726`を削除して最初からやり直すことも可能。
4. **DB migrationのrollback**: 本統合ではSupabase migrationの追加・変更を一切行っていないため、migration rollbackは不要。
5. 既存の各PR（#14〜#28）のDraft PR自体は、本統合作業では一切merge・rebase・base変更していないため、個別に従来どおりレビュー・統合を進める選択肢も残っている。

## 12. 次のデザイン実装ブランチの作成条件

`design/mangai-ui-refresh`（PR #33）は、統合方針未確定だった`handoff/codex-to-claude-20260725`から分岐した状態のままである。デザイン実装（Phase D1以降のコード変更）に進む前に、以下がすべて完了していることを確認する。

1. 本Draft PR（`integration/maintenance-stack-20260726` → `feature/manga-canvas-mvp`）が責任者によりレビュー・承認されること。
2. 承認されたPRが実際に`feature/manga-canvas-mvp`へmergeされること（本ドキュメント作成時点では未merge）。
3. `docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`のビジュアル仕様（§4各画面末尾および§8「デザイン承認条件」）が責任者承認を得ること。

上記3点が揃った時点で、**mergeされた最新の`feature/manga-canvas-mvp`から新しい実装ブランチを作成**してPhase D1（トークン導入）以降に着手する。`design/mangai-ui-refresh`・PR #33をそのまま実装ブランチとして流用しない（同ブランチは`handoff/codex-to-claude-20260725`起点のままであり、本統合の成果を含まないため）。
