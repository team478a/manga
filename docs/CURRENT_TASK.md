# MANGAI Current Task

## 基本情報

- 更新日: 2026-07-28
- 状態: `COMPLETED`（Phase D3-C: Home画面ビジュアル刷新はPR #46として`feature/manga-canvas-mvp`へマージ済み。次フェーズは責任者判断待ち）
- リポジトリ: `team478a/manga`
- デフォルトブランチ: `feature/manga-canvas-mvp`（PR #46マージ済みコミット `817dc69` を含む）
- 本ファイルの更新ブランチ: `docs/phase-d3c-completion-sync-20260728`（文書同期専用のDraft PR。責任者承認なしにマージしない）
- 詳細記録: [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)

## 直前の完了事項: Phase D3-C（Home画面ビジュアル刷新、PR #46マージ済み）

`DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1に基づき、Home画面のProject一覧を横長リストからカードグリッドへ刷新した（PR #46、merge commit `817dc69`）。

- Project一覧を`auto-fill`の可変カードグリッド化（カード最大幅280px。固定列数なし）
- カバー画像中心のProjectカード（アスペクト比3:4）
- 作品名・更新日時・状態（一般／成人向け）Badgeの整理
- フィルタ（すべて／一般／成人向け）・並び替え（更新日時順／タイトル順）
- 操作ボタン（成人向け移行/バックアップ/複製/削除）は常時表示のまま維持（hoverだけに依存しない操作）
- `main.tsx`を大きく書き換えず、`features/home/project-view-model.ts`（純粋関数）・`components/home/HomeProjectCard.tsx`・`HomeProjectGrid.tsx`・`HomeProjectFilters.tsx`へ分離
- Windows CIの目視確認基盤（PR-Bで整備）へ、Home Projectカードグリッド固有の検証（描画確認・カード最大幅回帰確認・フィルタ切替・解像度別レイアウト確認・4件/10件以上スケール確認・1920×1080/1366×768のスクリーンショット）を追加

### レビューの経緯（詳細は`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`§9〜§12）

1. Windows CI 1〜3回目失敗: axe-coreの`color-contrast`違反（`.ds-button-danger`、Phase D2由来の既存不備）を診断・修正し成功（commit `f8386ed`）
2. ロケール修正（commit `681f38d`）: Home画面のスクリーンショットが実際の日本語UIで撮影されるよう修正
3. 責任者レビュー指摘（第2ラウンド）: 「Projectが1件のときカードが画面全幅まで拡大し、作品名・Badge・操作ボタンが初期表示の下へ押し出される」不具合を発見。`.home-project-grid`を`auto-fit, minmax(240px, 1fr)`から`auto-fill, minmax(240px, 280px)` + `justify-content: start`へ修正し、Windows GUI検証・テストデータ（4件・10件以上・長いタイトル・一般／成人向け混在）を拡張。あわせて未承認だった`@media (max-width: 899px)`（`BrowserWindow`の`minWidth: 1100`により実機で到達不可能なdead code）を削除
4. 上記修正の初回push（commit `e6fdae2`）でWindows CIが2件の新規失敗（過剰なチェック条件、複数Project作成による既存コマンドパレット検証への副作用）を検出 → 原因を切り分けて修正（commit `0fef460`）→ **Windows CI成功**（4チェックすべてgreen）
5. 責任者が commit `2f3a506` を承認（review `4796116241`）。CI・承認を再確認のうえDraft解除・merge commit方式でマージ（`817dc69`）

## 責任者による最終仕様確定（2026-07-28）

実装記録§8の確認事項について、責任者から以下の最終回答を得た。以後、これらは「未決定事項」ではなく確定仕様として扱う。

1. **フィルタは「すべて／一般／成人向け」で確定**（実装どおり）
2. **並び替えは「更新が新しい順／タイトル順」で確定**（実装どおり）
3. **「お気に入り」フィルタは今回実装しない**（将来必要になった場合は`Project`型へのフィールド追加・DB migrationの提案から着手する）
4. **ページ数表示は今回実装しない**（将来必要になった場合は新規の読み取り専用IPC追加の提案から着手する）
5. **説明文（subtitle/description）はHomeカードに表示しない**（実装どおり）
6. **カバー画像ありProjectの目視確認・キーボード実機操作確認は、Windows実機によるRC受入れ時に実施する**（本フェーズのWindows CIはカバーなしテストデータのみで完了扱いとする。既存IPCの制約で自動生成できない理由は§7・§8参照）

## 未完了・次の作業

1. カバー画像あり・キーボード実機操作の確認は、次回のWindows実機RC受入れ機会に実施する（担当は未定。実施時は本ファイルまたは`docs/REMAINING_TASKS.md`へ結果を記録する）
2. 次画面のビジュアル刷新（`DESKTOP_CREATIVE_STUDIO_SPEC.md`§5ブレークポイント再編・設定画面2ペイン化・AI画像生成画面新設等）は、責任者の明示的な着手承認を待って着手する
3. 依存パッケージ（`npm audit`High 11件・Dependabot PR #4〜#13）の個別評価は、別ブランチ（`chore/dependency-security-triage-20260727`想定）で継続する（未着手）
4. **本ファイルを更新した`docs/phase-d3c-completion-sync-20260728`ブランチのDraft PR自体も、責任者の明示的な承認なしにマージしない**

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
6. [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)（Phase D3-Cの詳細記録。マージ済み）
7. [`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`](design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md)（Windows CI目視確認基盤の記録）
8. [`docs/design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md`](design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md)（コマンドパレット画面接続の記録）
9. [`docs/design/DESKTOP_CREATIVE_STUDIO_SPEC.md`](design/DESKTOP_CREATIVE_STUDIO_SPEC.md)（コンポーネント仕様の正本。§5は未承認のまま残っている点に注意。§8のHome画面関連項目は本ファイルの「責任者による最終仕様確定」で決着済み）
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
- **Phase D3-C: Home画面ビジュアル刷新（PR #46、merge commit `817dc69`）** — 詳細: [`docs/design/PHASE_D3C_HOME_VISUAL_REFRESH.md`](design/PHASE_D3C_HOME_VISUAL_REFRESH.md)
