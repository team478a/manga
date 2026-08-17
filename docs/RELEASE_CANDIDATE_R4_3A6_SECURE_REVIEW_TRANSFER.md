# RELEASE CANDIDATE: PR-R4-3A-6 Secure Human Review Transfer

作成日: 2026-08-17

状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / ENCRYPTED_PACKAGES_READY / OUTBOUND_NOT_SHARED / HUMAN_REVIEW_REQUIRED`

## 1. 目的

Candidate Visual Benchmarkの権利確認者とHuman Reviewer A/Bへ、private画像を公開せずスマートフォンで受け渡せる暗号化封筒を提供する。Visual Judge、runtime品質判定、自動修復には進まない。

## 2. 契約

- PBKDF2-HMAC-SHA-256、310,000 iterations、16-byte random salt
- AES-256-GCM、12-byte random IV、128-bit authentication tag
- version、元ZIP SHA-256、byte lengthをadditional authenticated dataへ束縛
- パスフレーズは24文字以上のファイル入力限定
- CSP `connect-src 'none'`、remote resourceなし
- 中立HTML／receiptにslot、package ID、元名、秘密値を含めない
- recipient roleとpackage slotを暗号化前に一致確認
- no-overwrite、wrong passphrase、tamper、SHA mismatchをfail closed

## 3. 実Batch証跡

Git外private rootで以下を作成した。

| 封筒 | 内容 | ケース | 復号・SHA |
| --- | --- | ---: | --- |
| transfer-01 | 権利確認 | 28 | PASS |
| transfer-02 | Human Reviewer A | 28 | PASS |
| transfer-03 | Human Reviewer B | 28 | PASS |

各封筒は別パスフレーズ、別salt、別IVを使用する。対応表とパスフレーズはoutboundと分離したGit外フォルダへ保存した。外部upload、外部共有、Human回答は行っていない。

## 4. 検証

- 集中テスト: 3/3
- 実権利確認package validator: 28件 PASS、C2PA必須chunk確認
- 実封筒build／decrypt／SHA／inner package: 3/3 PASS
- dependency／module boundary: 0 error
- lint: PASS
- Hub typecheck: PASS
- Hub tests: 784/784 PASS
- Canvas: 26/26 PASS
- AI: 48/48 PASS
- migration: 59本 PASS
- Webpack Hub build: PASS
- RC structure preflight: READY
- diff check: PASS
- 通常Turbopack: 既知Windows path lengthで停止
- ローカル`file://`ブラウザ操作: Browser安全ポリシーで停止。迂回せず受領スマートフォン確認へ残す

## 5. 不変境界

Production、既存作品、DB、migration、RPC、RLS、Storage、API、URL、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、runtime Visual Judge、自動修復、Canvas、checkpoint、PNG／PDF、成人向け境界、Desktopを変更しない。

## 6. rollback

Git変更はPRをrevertする。Git外の誤った封筒はprivate mappingで対象を確認してquarantineへ移し、同じファイル名を上書きせず、新しいパスフレーズ、salt、IV、出力名で再生成する。元ZIPは変更しない。

## 7. 停止条件

Draft PR、全CI、Vercel Preview成功後に停止する。受取人、HTML共有経路、パスフレーズ共有経路の3点を責任者が指定するまで外部送信しない。人間の権利確認、独立A/B review、不一致裁定が完了するまで正式Benchmarkへ加算せず、R4-3Bへ進まない。

## 8. PR／CI

- Draft PR: [#298](https://github.com/team478a/manga/pull/298)（Draft／MERGEABLE）
- Vercel Preview: [Ready／SSO保護](https://mangai-hub-staging-mb4xx3i63-team478as-projects.vercel.app)
- 実装HEAD `1a06e46`: Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsすべて成功
- 最終証跡同期HEADでも同じ5チェックを再確認して停止する
