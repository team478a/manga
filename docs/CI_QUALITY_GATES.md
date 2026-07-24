# CI品質ゲート

## 変更概要

Hub品質検査とSupabase migration検査を`.github/workflows/quality.yml`へ統合し、PRと既定ブランチへのpushで常に実行します。DesktopのWindows固有ビルドは`.github/workflows/desktop-windows.yml`へ分離しました。

## 修正対象の問題

- 既定ブランチが`feature/manga-canvas-mvp`である一方、旧workflowのpush対象が`main`だけだった
- path filterにより、PRで必須検査が作成されない場合があった
- Hub、DB、Desktopをまとめて必須化できる安定したcheck名がなかった
- テストログとbuild成果物がCI終了後に取得できなかった

## Required checks

既定ブランチのbranch protectionでは、次のcheck名を必須にします。

1. `Required Quality / Core quality`
2. `Required Quality / Migration roundtrip`
3. `Desktop Windows / Windows build`

check名を変更するとbranch protectionが満たせなくなるため、workflow名とjob表示名は運用上の公開契約として扱います。

## 実行内容

`Required Quality / Core quality`:

- rootとDesktopの`npm ci`
- framework非依存の共有packageを依存順にbuild
- ESLint、TypeScript、Hub production build
- Hub、Canvas、AI、Desktop test
- migration manifest検査
- Release Candidate preflight
- testログとHub buildのartifact保存

`Required Quality / Migration roundtrip`:

- PostgreSQL 16への全migration適用
- reverse順rollback
- rollback後の再適用
- canonical schema二重適用とデータ冪等性
- Marketplace assertion
- test schemaに対するstaging preflight

`Desktop Windows / Windows build`:

- rootとDesktop双方のlockfile固定install
- Windows上のTypeScript、ESLint、Desktop test、アクセシビリティtest
- 型検査前に共有packageをクリーン環境でbuild
- 署名不要のWindows x64展開ビルド
- testログと展開ビルドのartifact保存

同じPRまたはブランチの古い実行は`concurrency`でキャンセルします。testログは14日、build artifactは7日保持します。

## Branch protection

既定ブランチ`feature/manga-canvas-mvp`には次を設定します。

- required checks 3件を必須化し、最新ブランチへの更新を要求
- 直接pushを禁止
- 1名以上の承認reviewを要求
- 未解決conversationがある場合はmergeを禁止
- force pushとbranch deletionを禁止

将来`main`を正式な既定ブランチへ変更する場合も、workflowはそのままpushを検査できます。同じ保護設定を`main`へ移した後、旧既定ブランチの扱いを決定してください。

## DB migration・後方互換性・セキュリティ

DB migrationはありません。アプリケーション、公開API、保存形式、Desktop IPCには変更を加えていません。CI権限は`contents: read`だけで、credentialやService Role Keyをworkflowへ追加しません。Release用の署名workflowは既存のまま分離されています。

production監査で検出したNext.jsとSharpのhigh severity advisoryへ対応するため、Next.jsを16.2.11、rootとNext.js推移依存のSharpを0.35.3へ更新しました。`npm audit`はproduction／developmentを含めて0件です。

Dependabotはroot npm、Desktop npm、GitHub Actionsを毎週月曜日に確認します。Electron、Next.js、Sharp、better-sqlite3、Stripe、Supabaseなどの更新PRでは、package manifestだけでなくlockfile差分、native moduleの対応OS・Node ABI、release note、required checksを必ずreviewしてください。自動mergeは行いません。

## 手動確認

1. PRを作成し、Required QualityとDesktop Windowsがpathに関係なく開始することを確認する
2. 3つのrequired checkが成功するまでmergeできないことを確認する
3. 新しいcommitをpushし、同じPRの古い実行がキャンセルされることを確認する
4. Actions画面からtestログ、Hub build、Windows buildをダウンロードできることを確認する
5. review未承認またはconversation未解決のPRをmergeできないことを確認する

## Rollback

1. branch protectionから上記3つのrequired checkを一時的に外す
2. `.github/workflows/quality.yml`と`.github/workflows/desktop-windows.yml`を削除する
3. 旧`hub-quality.yml`と`hub-db-migrations.yml`を復元する
4. 必要ならbranch protection自体を以前の状態へ戻す

workflowを先に削除するとrequired checkが永久に待機するため、rollback時はbranch protectionを先に変更します。

## 残課題

- 正式な既定ブランチを`main`へ切り替える時期の決定
- Phase 4での依存グラフ検査追加
