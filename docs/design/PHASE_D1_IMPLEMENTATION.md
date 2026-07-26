# Phase D1: MANGAI Desktopデザイントークン基盤整備

作成日: 2026-07-26
状態: 実装完了（コード変更あり）。Phase D2以降のトークン利用は未着手。
ブランチ: `design/phase-d1-desktop-tokens`（base: `feature/manga-canvas-mvp` @ `dc89e0b`、PR #34マージ後）

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§2、[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)、[`UI_REDESIGN_PLAN.md`](UI_REDESIGN_PLAN.md)

## 1. 追加したトークン

`apps/desktop/src/renderer/styles.css`の`:root`ブロック末尾へ、既存24トークンの後に59行を追加した。値はすべて`DESKTOP_CREATIVE_STUDIO_SPEC.md`§2を正本として転記している。

### Elevation / Glass（グラス表現は一時UI限定）

| トークン | 値 |
| --- | --- |
| `--bg-raised` | `#242936`（既存`--bg-hover`と同値を再利用） |
| `--bg-glass` | `rgb(23 26 33 / 72%)` |
| `--glass-bg` | `rgb(23 26 33 / 72%)` |
| `--glass-blur` | `20px` |
| `--glass-border` | `rgb(243 245 247 / 8%)` |
| `--glass-shadow` | `var(--shadow-dialog)`（既存トークンを再利用） |

### Accent

| トークン | 値 |
| --- | --- |
| `--accent-active` | `#5638c2`（既存`--accent`を約12%暗くした値） |

### Spacing（4pxグリッド）

`--space-1: 4px` / `--space-2: 8px` / `--space-3: 12px` / `--space-4: 16px` / `--space-5: 20px` / `--space-6: 24px` / `--space-8: 32px` / `--space-10: 40px` / `--space-12: 48px` / `--space-16: 64px`

### Typography

`--text-2xs: 11px` / `--text-xs: 12px` / `--text-sm: 13px` / `--text-base: 14px` / `--text-md: 15px` / `--text-lg: 18px` / `--text-xl: 20px` / `--text-2xl: 24px`

### Radius

`--radius-xs: 4px` / `--radius-sm: 6px` / `--radius-md: 8px` / `--radius-lg: 12px` / `--radius-pill: 999px`

### Motion

`--motion-fast: 120ms` / `--motion-base: 180ms` / `--motion-slow: 240ms` / `--ease-standard: cubic-bezier(0.2, 0, 0, 1)`

### Layout

`--rail-width: 56px` / `--topbar-height: 48px` / `--statusbar-height: 28px`

## 2. 既存トークンとの対応

既存24トークン（`--bg-app`、`--bg-panel`、`--bg-panel-elevated`、`--bg-hover`、`--bg-selected`、`--border-subtle`、`--border-strong`、`--text-primary`、`--text-secondary`、`--text-muted`、`--accent`、`--accent-hover`、`--accent-text`、`--accent-soft`、`--success`/`--success-soft`、`--warning`/`--warning-soft`、`--danger`/`--danger-soft`、`--info`/`--info-soft`、`--canvas-workspace`、`--canvas-page`、`--focus-ring`、`--shadow-panel`、`--shadow-dialog`）は、**1文字も変更していない**。`git diff`は追加行のみで削除行が0であることを確認済み（§5参照）。

新規トークンは既存トークンの値を再利用するものが2つある（`--bg-raised`は`--bg-hover`と同値、`--glass-shadow`は`var(--shadow-dialog)`）。これは意図的な再利用であり、既存トークンの意味を変えるものではない。

## 3. 見た目への影響

**なし。** 追加したトークンはいずれも`:root`内で定義されるのみで、既存のどのセレクタ・クラス・コンポーネントからも参照されていない。`apps/desktop/tests/design-tokens.test.mjs`の「新しいglass系トークンは常設UIセレクタへまだ適用されていない」テストで、`:root`ブロック外に新規glassトークンの`var(--bg-glass...)`/`var(--glass-...)`参照が存在しないことを機械的に確認している。

以下は指示通り、本フェーズでは一切行っていない。

- Home画面のカード化
- AppHeaderの高さ変更
- GlobalNavの幅変更
- Project一覧レイアウト変更
- コマンドパレット実装
- Button/Card/FormFieldのReactコンポーネント実装
- MangaCanvas、GenerationJobs、AISettingsの変更
- API、DB、Storage、IPCの変更
- 新規依存パッケージの追加
- Tailwindの導入

## 4. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `apps/desktop/src/renderer/styles.css` | `:root`ブロックへ新規トークン59行を追加（既存24トークンは無変更、他のセレクタも無変更） |
| `apps/desktop/tests/design-tokens.test.mjs`（新規） | 既存トークン値の非破壊確認、新規トークン値の正当性確認、既存セレクタ（`.skip-link`、`prefers-reduced-motion`、`forced-colors`）の維持確認、glassトークンが常設UIへ未適用であることの確認 |
| `apps/desktop/package.json` | `test`スクリプトの実行対象ファイル一覧へ`tests/design-tokens.test.mjs`を追加（1行のみ変更） |
| `docs/design/`配下6ファイル | `design/mangai-ui-refresh`（PR #33）から文書のみを`git checkout origin/design/mangai-ui-refresh -- docs/design`で取り込み（別コミット、UIコード・CSSは取り込んでいない） |
| `docs/design/PHASE_D1_IMPLEMENTATION.md`（本ファイル、新規） | 本記録 |
| `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md` | 更新 |

## 5. テスト結果

`design/phase-d1-desktop-tokens`ブランチ（base: `feature/manga-canvas-mvp` @ `dc89e0b`）で実行。

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**108/108**。既存98件 + 新規`design-tokens.test.mjs`10件。既存テストの回帰なし） |
| `npm run desktop:build` | PASS |
| `git diff --check` | PASS（空白関連の警告なし） |
| `git diff apps/desktop/src/renderer/styles.css` | 追加59行、削除0行（既存トークン・セレクタへの変更なし） |

## 6. Accessibility結果

| 項目 | 結果 |
| --- | --- |
| `npm run desktop:test:a11y`（ローカル） | **LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT** — 本コンテナ環境にXサーバー（ディスプレイ）が存在せず、Electronのレンダラープロセスを起動できない（`Missing X server or $DISPLAY`、root権限でのsandbox制限とは別要因）。コード・テストスクリプトへの変更は行っていない |
| GitHub Actions Desktop Windows workflow | 本PR作成時点で未実行（push後にCIが起動する）。過去のPR #34では同workflowの`npm run test:a11y`がWindowsランナー上でPASSしており、本フェーズもCSS変数の追加のみで既存セレクタ・レイアウトへの影響がないため、同様にPASSする見込み。CI結果が確定次第、本ドキュメントとPRへ追記する |

Accessibility全体をローカル実行不可のみでBLOCKED扱いにせず、GitHub Actions側の結果と合わせて判断する方針を踏襲している。

## 7. ロールバック方法

1. **本PR全体の取り消し**: `design/phase-d1-desktop-tokens`ブランチとDraft PRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（本ブランチはまだmergeされていない）。
2. **トークン追加のみを取り消す**: `apps/desktop/src/renderer/styles.css`の追加ブロック（`/* Phase D1 (MANGAI Creative Studio) additive tokens. */`コメントから`:root`の閉じ`}`直前まで）を削除すれば、Phase D0時点の状態へ完全に戻る。既存トークン・既存セレクタは触れていないため、この範囲を削除するだけで安全にロールバックできる。
3. **テストのみを取り消す**: `apps/desktop/tests/design-tokens.test.mjs`を削除し、`apps/desktop/package.json`の`test`スクリプトから`tests/design-tokens.test.mjs`を取り除けば、テスト実行対象も元に戻る。
4. **docs/designの取り込みを取り消す**: `git revert`または該当コミット（`docs(design): adopt MANGAI Creative Studio specification`）の取り消しで、設計文書のみを個別に戻せる（トークン追加のコミットとは独立している）。
5. DB migration、API、Storage、IPCへの変更は一切ないため、上記いずれのロールバックもデータ影響はない。

## 8. Phase D2へ進む条件

- [ ] 本PR（Phase D1）が責任者レビューを受け、`feature/manga-canvas-mvp`へmergeされること
- [ ] GitHub Actions Desktop Windows workflowでのAccessibility結果がPASSであることを確認すること
- [ ] Phase D2では、`DESIGN_SYSTEM.md`§3・`DESKTOP_CREATIVE_STUDIO_SPEC.md`§3の共通コンポーネント仕様（Button、Card、StatusBadge、FormField、フローティングツールバー等）を実装する。本フェーズで追加したトークンを実際に消費するのはPhase D2からであり、Phase D1では意図的にどのコンポーネント・セレクタからも参照させていない
- [ ] Phase D2でReactコンポーネントを追加する際も、既存画面（Home、制作ワークスペース、設定画面等）への適用は行わず、まずコンポーネント単体の実装・確認に留める（`UI_REDESIGN_PLAN.md`Phase D2の記載どおり）
