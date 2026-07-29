# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-29
- 状態: `IN_PROGRESS`（検索候補収集基盤の実装・全CI完了、外部E2E／責任者承認待ち）
- リポジトリ: `team478a/manga`
- Base: `codex/cloud-research-source-verification`（Draft PR #57）
- Branch: `codex/cloud-research-search-foundation`
- Release 1 Draft PR: [#50](https://github.com/team478a/manga/pull/50)
- Release 2 Draft PR: [#51](https://github.com/team478a/manga/pull/51)
- Release 3 Draft PR: [#52](https://github.com/team478a/manga/pull/52)
- Release 4 Draft PR: [#53](https://github.com/team478a/manga/pull/53)
- Release 5 Draft PR: [#54](https://github.com/team478a/manga/pull/54)
- Release 6 Draft PR: [#55](https://github.com/team478a/manga/pull/55)
- Research Quality v2 Draft PR: [#56](https://github.com/team478a/manga/pull/56)
- 出典Server検証 Draft PR: [#57](https://github.com/team478a/manga/pull/57)
- 検索候補収集 Draft PR: [#58](https://github.com/team478a/manga/pull/58)
- 計画: [`docs/cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_PLAN.md`](cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_PLAN.md)
- 仕様: [`docs/cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_SPEC.md`](cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_SPEC.md)

## 現在の目的

Web検索から出典候補を収集し、原文確認と安全なServer検証を経て市場分析へ採用できるResearch Discoveryを完成させる。

## 検索候補収集 実装済み

- Provider中立の検索interfaceとBrave Web Search adapter
- 日本向け、strict safe search、Web結果限定、鮮度指定
- 認証・Feature Flag・Server API keyのfail closed
- 検索語をMANGAI画面URLへ出さないPOST Server Action
- Provider timeout、512 KiB上限、schema／HTTPS URL検証、重複排除
- 既存DB RPCを再利用した全体300回/分・Profile 10回/分のrate limit
- 出典検証allowlist適合状態の表示
- 原文確認と、タイトル／URL／公開日時／根拠分野だけをFormへ採用する導線
- 検索snippetを確認済み事実へ自動転記しない契約

## 出典Server検証 実装済み

- 明示した完全一致hostだけを許可するFeature Flag付き外部取得
- HTTPS、443番port、認証情報なし、IP literal禁止
- DNS解決結果のpublic IP確認とredirectごとの再検証
- private／loopback／link-local／予約アドレスの拒否
- 7秒timeout、最大3 redirect、対応MIME制限、streaming 1MB上限
- 最終URL、検証日時、MIME、byte数、SHA-256、HTML titleの保存
- 取得本文をDBへ保存しない契約
- 検証済み出典数のResearch Quality score反映と画面表示
- 未検証時の明示表示と、Feature Flag無効時の既存フロー維持

## Research Quality v2 実装済み

- 出典種別、任意の公開日時、根拠分野の構造化入力
- 分析項目ごとのclaim-level URL
- 出典事実／利用者入力／AI推論の根拠区分
- 項目別confidenceとlimitations
- 0〜100の根拠品質score、独立ドメイン、180日以内の出典、分野網羅率
- 不足分野、古い出典、未来日時、単一ドメイン依存の警告
- `research-rules-v1` Reportの表示・後続工程互換
- `research-rules-v2`を許可するmigration／rollback／canonical schema
- 企画・シナリオ・マンガ生成までの回帰テスト

## Release 6までの基盤

Release 5で承認された一般向けCloud Projectを、非公開作品・販売停止商品として安全かつ冪等に販売準備へ同期できるRelease 6の縦型機能を完成させる。

## 実装済み

- `CLOUD_SALES_PREPARATION_MVP_ENABLED`（未設定時fail closed）
- 販売準備一覧・詳細と、Dashboard／作品管理／Creatorからの段階導線
- Release 5で現行revisionが`approved`の一般向けProjectだけを同期
- 既存のCloud PDF／表紙exportを再利用
- 1 Projectにつき非公開`works` 1件・`paused`商品1件へ冪等同期
- 同期済みrevision・価格・作品／商品ID・同期日時の保存
- 未同期／同期済み／要再同期／販売中の状態表示
- Project再編集で承認が失効した場合の再同期拒否
- 公開済み作品または販売中商品の自動上書き禁止
- 所有者RLS、利用者の同期記録table直接更新禁止
- 旧Marketplace RPCの認証ユーザー直接実行を廃止し、承認ゲート付きRPCへ集約
- PostgreSQL実動作テストをCI migration roundtripへ追加
- migration／rollback／canonical schema／manifest
- 計画・仕様文書

## 重要な設計判断

- Release 6は既存Cloud Project、Release 5承認、既存Marketplace下書きを正本として再利用する。
- 同期は単一transaction内で承認とrevisionを再検証し、二重送信でも重複作成しない。
- Cloudからは公開・販売開始を自動実行せず、既存Dashboardで人が最終確認する。
- 公開済み／販売中のデータはCloud再同期で上書きしない。
- Canvas Editor、Cloud AI、Stripe決済、Marketplace公開業務、Desktopは変更しない。
- Release 1〜5の外部E2E未完了は解除せず、Release 6をstacked branchで先行している。

## 検証

- Hub全テスト: PASS（186/186）
- Research〜Manga回帰focused test: PASS（42/42）
- deps:check: PASS
- lint: PASS
- typecheck: PASS（Hub + Desktop、Desktop変更なし）
- migration検証: PASS（23件）
- PostgreSQL migration往復／canonical schema検査: PASS
- PostgreSQL販売準備同期・冪等性・承認失効動作テスト: PASS
- production build: PASS
- Draft PR #57 CI: PASS（Core quality、Migration roundtrip、Vercel、Windows build）
- Draft PR #58 CI: PASS（Core quality、Migration roundtrip、Vercel、Windows build）
- 外部環境E2E: 未実施

## 外部環境待ち

1. Release 1〜6 migrationを対象Supabaseへ順番に適用
2. Vercelで`CLOUD_RESEARCH_MVP_ENABLED=true`
3. Vercelで`CLOUD_RESEARCH_SOURCE_VERIFICATION_ENABLED=true`
4. Vercelで`CLOUD_RESEARCH_SOURCE_ALLOWED_HOSTS`へ信頼済み公式hostを設定
5. Brave Search APIの契約・課金承認・API key発行
6. Vercelで`CLOUD_RESEARCH_SEARCH_ENABLED=true`、`BRAVE_SEARCH_API_KEY`、rate-limit秘密値を設定
7. Vercelで`CLOUD_PROPOSAL_MVP_ENABLED=true`
8. Vercelで`CLOUD_SCENARIO_MVP_ENABLED=true`
9. Vercelで`CLOUD_MANGA_MVP_ENABLED=true`
10. Vercelで`CLOUD_WORK_MANAGEMENT_MVP_ENABLED=true`
11. Vercelで`CLOUD_SALES_PREPARATION_MVP_ENABLED=true`
12. 実検索 → 原文確認 → 候補採用 → Server検証 → Report保存E2E
13. 市場分析 → 企画 → シナリオ → マンガ下書き → Creator編集 → Page確認 → 承認 → 販売準備同期の実ブラウザE2E
14. 許可host、危険redirect、timeout、容量超過、未検証表示の実環境確認
15. 別利用者RLS、revision失効、二重送信、公開済み／販売中上書き拒否の確認
16. 390px／768px／1280px受入れ
17. 全CIと責任者承認

## 禁止事項

- `feature/manga-canvas-mvp`への直接push／merge
- Draft PR #50〜#58の外部ゲート未完了扱いの解除
- 既存migrationの変更
- Cloud AI Queue／Worker／Provider Gateway、Canvas Editor本体、Stripe決済、Marketplace公開業務、Desktopへの変更
- 成人向けコンテンツのCloud処理
- 全CI・外部E2E・責任者承認前のmerge

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル
5. `docs/HANDOFF_LOG.md`
6. `docs/cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_PLAN.md`
7. `docs/cloud/CLOUD_RESEARCH_SEARCH_FOUNDATION_SPEC.md`
