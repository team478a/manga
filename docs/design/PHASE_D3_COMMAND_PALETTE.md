# Phase D3: コマンドパレット（Ctrl+K）単体実装

作成日: 2026-07-26
状態: 実装完了（コード変更あり）。グローバルショートカット配線・既存画面統合は未着手。
ブランチ: `design/phase-d3-command-palette`（base: `feature/manga-canvas-mvp` @ `2b4f97d`、PR #35〜#38マージ後）

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§3.4

## 1. スコープ

Phase D2で確立した方針（Button/Card/FormField/FloatingToolbarを、既存画面へ配線する前にまず単体コンポーネントとして実装する）を踏襲し、コマンドパレットも**単体のReactコンポーネントとして実装するのみ**とした。以下は本フェーズのスコープ外。

- `Ctrl+K`のグローバルキーボードショートカット登録（`main.tsx`等、既存アプリシェルへの変更が必要）
- 上部バーへの検索ボックス風トリガーボタンの設置
- 「移動」セクションの実際の画面遷移ロジック、「アクション」セクションの現在画面文脈に応じた項目生成、「AI」セクションの実際のAI Provider関連ナビゲーション
- 「最近」セクションの実データ

これらは`CommandPalette`コンポーネントを消費する側（既存画面・アプリシェル）の実装であり、`sections` propとして注入されるデータ・コールバックはすべて呼び出し側が用意する設計とした。既存画面へ実際に組み込むのは、責任者の判断を経てからの次フェーズとする。

## 2. 実装したコンポーネント

`apps/desktop/src/renderer/components/common/CommandPalette.tsx`

```tsx
type CommandItem = { id: string; label: string; hint?: string; onSelect: () => void };
type CommandSection = { id: string; label: string; items: CommandItem[] };
type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  sections: CommandSection[];
  placeholder?: string; // 既定「コマンドを入力…」
};
```

データ駆動（`sections`/`items`はすべて呼び出し側から注入）で、コンポーネント自身はナビゲーション先やAI Provider操作について一切の知識を持たない。

### 実装した仕様項目（§3.4）

- オーバーレイ: `rgb(0 0 0 / 50%)`のスクリム、クリックで閉じる（`onClick={onClose}`、パネル内クリックは`stopPropagation`）
- パネル: `--bg-glass` + `backdrop-filter: blur(--glass-blur)` + `1px solid --glass-border` + `--glass-shadow`、角丸`--radius-lg`
- 幅: 640px（既定）/ 520px（既存の`max-width: 1365px`ブレークポイントで切替。**§5の未承認のブレークポイント再編は使用せず、現行実装のブレークポイントのみを使用**）
- 検索入力: `--text-md`、高さ44px、placeholder「コマンドを入力…」、`role="combobox"`
- 結果リスト: セクション見出し（`--text-2xs`、`--text-muted`、大文字トラッキング）+行（高さ36px、ラベル`--text-sm`+右寄せショートカットヒント`--text-2xs`）
- キーボード: ↑↓で移動（循環）、Enterで実行、Escで閉じる。開いた瞬間に検索入力へフォーカス、閉じたら呼び出し元要素へ復帰
- 検索: `query`文字列でラベルの部分一致フィルタ（大文字小文字区別なし）。一致0件のセクションは非表示
- アクセシビリティ: `role="dialog"` `aria-modal="true"`、`role="listbox"`/`role="option"`、`aria-selected`、`aria-activedescendant`、結果件数を`aria-live="polite"`（視覚的には`.ds-visually-hidden`で非表示）で通知

### 安全境界（§3.4「安全境界（重要）」）

`CommandItem`の唯一のアクションフックは呼び出し側が渡す`onSelect: () => void`であり、コンポーネント自身はAI Providerの有効/無効切替・成人向け処理・費用承認等について一切のAPIを持たない。「AIセクションの該当行は設定画面のAI Providerセクションへ遷移するだけ」という安全境界は、実際の画面統合時に**呼び出し側の`onSelect`実装が「遷移のみ」であることを守る**ことで担保する設計であり、本コンポーネントはその選択を強制も阻害もしない中立なリスト表示に徹している。`apps/desktop/tests/design-command-palette.test.mjs`で、コンポーネントソースにProvider切替を示唆する識別子（`enableProvider`/`toggleProvider`等）が存在しないことを機械的に確認している。

## 3. グラス表現・アクセシビリティ

`--bg-glass`/`--glass-blur`/`--glass-border`/`--glass-shadow`を消費するのは`.ds-command-palette`（本コンポーネントのパネル）と、Phase D2の`.ds-floating-toolbar`のみ。`forced-colors`時は不透明`--bg-panel`+`1px solid CanvasText`へ自動フォールバックする。`apps/desktop/tests/design-tokens.test.mjs`のglass検査テストのallowlistへ`.ds-command-palette`を追加した。

開閉時のアニメーションは実装していない（表示/非表示の即時切替のみ）ため、`prefers-reduced-motion`の追加対応は不要。

## 4. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `apps/desktop/src/renderer/components/common/CommandPalette.tsx`（新規） | コマンドパレットコンポーネント |
| `apps/desktop/src/renderer/styles.css` | `.ds-command-palette*`/`.ds-visually-hidden`クラスを追加、`.ds-command-palette`用`forced-colors`フォールバックを追加（既存ルールは無変更） |
| `apps/desktop/tests/design-command-palette.test.mjs`（新規） | props・ARIA・キーボード操作・安全境界・未適用（画面からimportされていないこと）を確認する7件のテスト |
| `apps/desktop/tests/design-tokens.test.mjs` | glassトークン検査のallowlistへ`.ds-command-palette`を追加 |
| `apps/desktop/package.json` | `test`スクリプトへ`tests/design-command-palette.test.mjs`を追加 |
| `docs/design/PHASE_D3_COMMAND_PALETTE.md`（本ファイル、新規） | 本記録 |
| `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md` | 更新 |

## 5. テスト結果

`design/phase-d3-command-palette`ブランチ（base: `feature/manga-canvas-mvp` @ `2b4f97d`）で実行。

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**127/127**。既存120件 + 新規`design-command-palette.test.mjs` 7件、回帰なし） |
| `npm run desktop:test:a11y`（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT（本コンテナにXサーバーがなくElectron起動不可。Phase D1/D2と同一要因） |
| `npm run desktop:build` | PASS |
| `git diff --check` | PASS |

## 6. 変更していないこと

- Ctrl+Kのグローバル登録、上部バーへのトリガーボタン設置
- Home、制作ワークスペース、AI画像生成、設定画面のいずれか
- API、DB、Storage、Desktop IPC
- 新規依存パッケージの追加、Tailwindの導入
- `DESKTOP_CREATIVE_STUDIO_SPEC.md`§5の未承認ブレークポイント再編（既存の`1365px`のみ使用）

## 7. ロールバック方法

1. **本PR全体の取り消し**: ブランチ・PRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（未マージの間）。
2. **コンポーネント追加のみを取り消す**: `CommandPalette.tsx`を削除し、`styles.css`の`/* Phase D3 (MANGAI Creative Studio) command palette. */`コメント以降のブロックを削除すれば、Phase D2完了時点の状態へ戻る。
3. DB migration、API、Storage、IPCへの変更は一切ないため、ロールバックにデータ影響はない。

## 8. 次フェーズへ進む条件

- [ ] 本PRが責任者レビューを受け、`feature/manga-canvas-mvp`へmergeされること
- [ ] `Ctrl+K`のグローバル配線・上部バートリガー・実際のセクションデータ（移動/アクション/AI/最近）の実装は、責任者の明示判断があるまで着手しない
- [ ] 実装時は、AIセクションの該当行が設定画面のAI Providerセクションへの遷移のみであり、その場でのProvider有効化・切替を行わないことを、実装レビューで個別に確認する
