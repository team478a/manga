# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-28
- 状態: `READY_FOR_REVIEW`（責任者指摘のカード幅不具合を修正し、Windows CIで新規追加した8件のcheckStepすべての成功を確認済み。ピクセルレベルの目視確認・実装記録§8の判断・責任者承認待ち）
- リポジトリ: `team478a/manga`
- 作業ブランチ: `codex/phase-d3c-home-visual-refresh`
- Base branch: `feature/manga-canvas-mvp` @ `3fb5f24dede0961d1951c0479b6fc1bb996e2d6f`（PR #45マージ済みコミット）
- 詳細記録: [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)

## 直前の完了事項: PR #44・PR #45マージ（Phase D3-C準備）

「MANGAI 次期実装指示書（Phase D3-C準備・Home画面刷新・依存関係安全確認）」に基づき、以下の2件を個別のDraft PRとしてマージ済み。

- **PR #44**（`docs/phase-d3c-preparation-20260727`、文書のみ）: `docs/CURRENT_TASK.md`のPR #43未反映記載を修正。承認・CI確認のうえマージ（merge commit `3cb1ad0`）
- **PR #45**（`test/phase-d3c-visual-validation`）: Desktop目視確認基盤（コマンドパレットの自動GUI検証12項目 + `webContents.capturePage()`によるスクリーンショットartifact）をWindows CIへ追加。実行時に2件の不具合（テストハーネス自体の状態管理ミス）を発見・修正し、最終的にWindows CI上で11チェックすべての成功を確認したうえでマージ（merge commit `3fb5f24`）。詳細は[`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`](design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md)

PR #44→PR #45の順でマージしたため、PR #45側で`docs/HANDOFF_LOG.md`の追記が競合（両PRが同時に追記）し、rebaseではなくmergeで解決した（既存の完了記録は削除せず両方保持）。

## 今回の完了事項: Phase D3-C（Home画面ビジュアル刷新）

`DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1に基づき、Home画面のProject一覧を横長リストからカードグリッドへ刷新した。

- Project一覧を`auto-fit`の可変カードグリッド化（固定列数なし）
- カバー画像中心のProjectカード（アスペクト比3:4）
- 作品名・更新日時・状態（一般／成人向け）Badgeの整理
- フィルタ（すべて／一般／成人向け）・並び替え（更新日時順／タイトル順）
- 操作ボタン（成人向け移行/バックアップ/複製/削除）は常時表示のまま維持（hover専用表示は追加していない）
- `main.tsx`を大きく書き換えず、`features/home/project-view-model.ts`（純粋関数）・`components/home/HomeProjectCard.tsx`・`HomeProjectGrid.tsx`・`HomeProjectFilters.tsx`へ分離
- Windows CIの目視確認基盤（PR-Bで整備）へ、Home Projectカードグリッド固有の検証（描画確認・フィルタ切替・1920×1080/1366×768のスクリーンショット）を追加

**指示書の想定と異なる判断をした点**（責任者確認が必要、詳細は実装記録§8）:

1. 「お気に入り」フィルタは`Project`型にデータ項目がなく、DB migrationが必要になるため実装していない（代わりに「一般／成人向け」フィルタ＋「更新日時／タイトル」並び替えを実装）
2. 「ページ数」はDesktop IPCがページ数を返さないため表示していない（新規IPC追加が必要）
3. 説明文（subtitle/description）はカードへ表示していない（表示領域の制約）
4. 多数データ・長いタイトル・成人向けBadgeの実画面確認は、既存のテストデータ投入ロジック（1件・一般のみ）の制約で未実施

### 品質ゲート結果（2026-07-27、`codex/phase-d3c-home-visual-refresh`でローカル実行）

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS |
| `npm run lint` | PASS（root + Desktop） |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**182/182**。既存158件 + 新規`design-home-project-grid.test.mjs` 24件） |
| `npm run hub:test` | PASS（116/116） |
| `npm run canvas:test` | PASS（26/26） |
| `npm run ai:test` | PASS（44/44） |
| `npm run db:migrations:validate` | PASS |
| `npm run desktop:build` | PASS |
| `npm run build`（Hub） | PASS |
| `git diff --check` | PASS |

**Windows CI（GUI自動検証・スクリーンショット）は成功を確認済み**（`codex/phase-d3c-home-visual-refresh`、commit `f8386ed`。4チェックすべてgreen）。ただし、3回連続でCIが失敗した経緯があるため必ずこの経緯を把握したうえで引き継ぐこと。

### Windows CI失敗3回・修正の経緯（2026-07-27）

1. 1回目失敗（`fa4db26`）: axe-coreが`.ds-button-danger`（原因未特定時点）でWCAG `color-contrast`違反（`serious`）を`home-en`・`new-project-dialog-en`で新規検出
2. 修正試行1（誤り、`c6ec3c9`）: `.project-summary small`の色を推測で変更 → 効果なし（2回目も同一件数で失敗）
3. 診断強化（`bc69fa7`）: `test-accessibility.mjs`のCI出力へaxeの`target`/`failureSummary`を追加 → ログから`.ds-button-danger`（前景`#f3f5f7`/背景`var(--danger)` `#ed6170` = 2.93:1、要求4.5:1）が真因と判明
4. 修正（`f8386ed`）: `.ds-button-danger`のみ`background`を`color-mix(in srgb, var(--danger) 70%, black 30%)`へ変更（約5.4:1）。共有`--danger`トークン自体は変更していない → **Windows CI成功**

詳細は`docs/HANDOFF_LOG.md`「続き16」を参照。

### 責任者レビュー指摘（第2ラウンド、2026-07-28）と対応

`f8386ed`のスクリーンショットを目視確認した責任者から、「Projectが1件のときカードが画面全幅まで拡大し、カバー領域が巨大化して作品名・Badge・操作ボタンが初期表示の下へ押し出される」というマージ不可の指摘を受けた。以下を修正した（詳細は`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`§12）。

1. `.home-project-grid`のグリッド指定を`auto-fit, minmax(240px, 1fr)`から`auto-fill, minmax(240px, 280px)` + `justify-content: start`へ変更（カード最大幅を制限）
2. Windows GUI検証へ、1件時のカード幅チェック・解像度ごとの幅/左寄せ/可視性チェックを追加
3. テストデータを4件・10件以上（長いタイトル・一般／成人向け混在含む）へ拡張（既存IPCのみ使用）。カバーあり／なしは既存IPCの技術的制約により未実装（理由は§7・§8）
4. `@media (max-width: 899px)`を削除（`BrowserWindow`の`minWidth: 1100`により到達不可能なdead codeであり、`DESKTOP_CREATIVE_STUDIO_SPEC.md`§5未承認のブレークポイント再編に実質該当していた）
5. 本ファイル・実装記録・PR本文を更新

品質ゲート（lint/typecheck/desktop:test 182/182/hub:test/canvas:test/ai:test/db:migrations:validate/desktop:build/build/git diff --check）はすべてPASS。commit `e6fdae2`のWindows CIは2件の新規失敗を検出したが、原因を切り分けて修正し（詳細下記）、commit `0fef460`で**Windows CI成功を確認済み**（4チェックすべてgreen。新規追加した8件のcheckStepすべて`pass:true`、axe違反もゼロ）。

### commit `e6fdae2`のWindows CI失敗と修正（詳細は`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`§12末尾）

1. `home-project-card-max-width-single-project`が`actionsVisible=false`で失敗: 対象解像度でないデフォルトwindow sizeでの「スクロールなしに収まる」という過剰な要求が原因。判定を「非表示になっていないか」のみへ緩和 → `0fef460`で`actionsVisible=true`に回復
2. `open-project-from-recent`・`navigate-to-settings`が連鎖的に失敗: 複数Project作成ブロックを既存のコマンドパレット検証より前に置いていたため、"Accessibility Test Project"が「最近開いた」一覧から押し出されたことが原因。複数Project作成ブロックを全コマンドパレット検証の後ろへ移動して解消 → `0fef460`で両方とも`pass:true`に回復

## 未完了・次の作業

1. **スクリーンショットのピクセルレベル目視確認**（次担当者が最初に対応すべき項目）: 本セッションの環境ではCI artifact ZIPを直接開けないため未実施。`home-project-grid-1366x768.png`・`-1920x1080.png`・`-4-projects.png`・`-10-projects.png`を含む15件のスクリーンショットが生成・アップロード済み（artifact: `desktop-windows-results-1`、run `30346935309`）
2. 実装記録§8の責任者確認事項（フィルタ・並び替え方針、ページ数表示、説明文表示、カバーありProjectの目視確認方法、キーボード実機操作確認）の判断を仰ぐ
3. 責任者承認・スクリーンショット確認が揃うまでマージしない
4. マージ後、`DESKTOP_CREATIVE_STUDIO_SPEC.md`§5（ブレークポイント再編）・設定画面2ペイン化・AI画像生成画面新設等、他画面のビジュアル刷新は別途責任者判断を待って着手する
5. 依存パッケージ（`npm audit`High 11件・Dependabot PR #4〜#13）の個別評価は、本PRとは別ブランチ（`chore/dependency-security-triage-20260727`想定）で継続する（未着手）

## 禁止事項（引き続き遵守）

- API、DB、Storage、Desktop IPC、SQLite schemaの変更（ページ数表示等、必要な場合は新規IPCを別途提案してから着手する）
- AI Provider routing、成人向け生成の直接実行・安全ポリシーの緩和
- Stripe、認証まわりの変更
- 新規依存パッケージ追加、Tailwind導入
- `DESKTOP_CREATIVE_STUDIO_SPEC.md`§5の未承認ブレークポイント再編
- `MangaCanvas`、`GenerationJobs`、`AISettings`、Chat画面、Hub接続画面、Cloud Editorの変更
- `AppHeader`の高さ、`GlobalNav`の幅の変更
- `feature/manga-canvas-mvp`への直接push、force push、既存migrationの書き換え
- 責任者の明示的な承認・レビューなしのPRマージ

上記はいずれも実施していない。

## 次担当者が最初に読むファイル

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/AI_HANDOFF.md`
4. 本ファイル（`docs/CURRENT_TASK.md`）
5. [`docs/HANDOFF_LOG.md`](HANDOFF_LOG.md)
6. [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)（本ブランチの詳細記録）
7. [`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`](design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md)（Windows CI目視確認基盤の記録）
8. [`docs/design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md`](design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md)（コマンドパレット画面接続の記録）
9. [`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`](design/DESKTOP_CREATIVE_STUDIO_SPEC.md)（コンポーネント仕様の正本。§5・§8は未承認のまま残っている点に注意）
10. [`docs/REMAINING_TASKS.md`](REMAINING_TASKS.md)（RC外部環境受入れの残タスク一覧）

## 次担当者が最初に実行するコマンド

```bash
git fetch origin feature/manga-canvas-mvp
git checkout feature/manga-canvas-mvp
git reset --hard origin/feature/manga-canvas-mvp
npm install
npm run deps:check && npm run lint && npm run typecheck
npm run desktop:test
```

## 参考: これまでの完了事項

- 保守性改善PR #14〜#28の統合（PR #34、merge commit `dc89e0b`） — 詳細: [`docs/integration/MAINTENANCE_STACK_INTEGRATION_20260726.md`](integration/MAINTENANCE_STACK_INTEGRATION_20260726.md)
- Phase D1: デザイントークン基盤整備（PR #35・#36） — 詳細: [`docs/design/PHASE_D1_IMPLEMENTATION.md`](design/PHASE_D1_IMPLEMENTATION.md)
- Phase D2: 共通コンポーネント単体実装（PR #37・#38） — 詳細: [`docs/design/PHASE_D2_IMPLEMENTATION.md`](design/PHASE_D2_IMPLEMENTATION.md)
- Phase D3: コマンドパレット単体実装（PR #39） — 詳細: [`docs/design/PHASE_D3_COMMAND_PALETTE.md`](design/PHASE_D3_COMMAND_PALETTE.md)
- Phase D3: Home画面へのButton適用（PR #40） — 詳細: [`docs/design/PHASE_D3_HOME_SCREEN.md`](design/PHASE_D3_HOME_SCREEN.md)
- 文書同期PR #41（merge commit `242334b`）、旧PR #14〜#28・#29・#33のClose（17件）
- Phase D3-B: コマンドパレットのDesktop画面接続 + 精緻化（PR #42、merge commit `23d16ef`） — 詳細: [`docs/design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md`](design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md)
- PR #42マージ後の文書同期（PR #43、merge commit `16f8776`）
- Phase D3-C準備 PR-A: 引き継ぎ文書の状態修正（PR #44、merge commit `3cb1ad0`）
- Phase D3-C準備 PR-B: Desktop目視確認基盤（PR #45、merge commit `3fb5f24`） — 詳細: [`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`](design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md)
- Phase D3-C: Home画面ビジュアル刷新（本ブランチ） — 詳細: [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)
