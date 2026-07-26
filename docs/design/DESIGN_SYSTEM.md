# MANGAI デザインシステム案（Design System Draft）

作成日: 2026-07-26
状態: **調査結果は承認済み（2026-07-26）。トークン値・コンポーネント実装は未承認の案のまま**。Desktopのテーマ・アクセントカラー・CSS基盤方針は責任者指示により確定済み（§5参照）。実装はビジュアル仕様（`UI_REDESIGN_PLAN.md`のPhase D0.5）の承認後、画面単位で開始する。

前提: [`CURRENT_UI_AUDIT.md`](CURRENT_UI_AUDIT.md)の監査結果に基づく。DesktopとHubは技術スタックが異なる（Desktop=プレーンCSS+CSS変数、Hub=Tailwind CSS）ため、**トークンの命名・カテゴリ設計は共通化し、実装（CSS変数 vs Tailwind theme）は製品ごとに分離する**方針とする。

---

## 1. 設計方針

1. Desktopの既存`:root`CSS変数（`styles.css:1-35`）とHubの既存Tailwind拡張（`tailwind.config.ts`）は、いずれも「土台としては健全」（監査結果§1参照）なため、ゼロから作り直さず、**命名を揃えて拡張する**。
2. トークンは4カテゴリ: **色（Color）**、**間隔（Spacing）**、**タイポグラフィ（Typography）**、**形状・効果（Radius/Shadow/Motion）**。
3. Desktopはダーク基調・Hubはライト基調のまま維持する（両製品の同時ライト/ダーク統一は本フェーズのスコープ外。理由: Desktop はWindows High Contrast対応を含む既存のダーク前提CSSが広範囲にあり、Hubは決済・公開ページでのブランド一貫性を優先するため）。
4. Konva描画色（Desktop Canvas）は、CSS変数を直接読めないため、**CSS変数と同じ値を持つJS定数モジュール（`canvas-palette.ts`のようなもの）を新設し、そこから読む**方式に統一する（設計のみ、実装は後続フェーズ）。

---

## 2. デザイントークン案

### 2.1 色（Color）

命名規則: `{role}-{variant?}`。roleは意味ベース（見た目の色名を直接使わない）。

| トークン名 | 用途 | Desktop現状 | Hub現状 | 備考 |
| --- | --- | --- | --- | --- |
| `color-bg-app` | アプリ全体の背景 | `--bg-app` | `body`の`#fffdf9`（`globals.css`） | 命名を`color-bg-app`に統一（値は製品ごとに維持） |
| `color-bg-surface` | パネル/カードの背景 | `--bg-panel` | `.panel`のTailwind値 | ― |
| `color-bg-surface-elevated` | 浮いた要素（modal等） | `--bg-panel-elevated` | 未定義（新設要） | Hub側にmodal用の明示トークンがないため新設候補 |
| `color-bg-hover` | hover状態 | `--bg-hover` | 個別のTailwind hover値 | ― |
| `color-bg-selected` | 選択状態 | `--bg-selected` | 個別実装 | ― |
| `color-border-subtle` | 通常境界線 | `--border-subtle` | Tailwind `border-stone-*` | ― |
| `color-border-strong` | 強調境界線 | `--border-strong` | 未整理 | ― |
| `color-text-primary` | 主要文字色 | `--text-primary` | `ink`（`#263238`） | Hubの`ink`とDesktopの`--text-primary`は役割が一致、命名だけ揃える |
| `color-text-secondary` | 補助文字色 | `--text-secondary` | Tailwind `text-stone-600`等 | ― |
| `color-text-muted` | 弱調文字色 | `--text-muted` | `.muted`クラス | ― |
| `color-accent` | ブランド強調色 | `--accent`（`#6848d8`） | `leaf`（`#3F7D58`） | **Desktop=紫系、Hub=緑系のまま維持**（ブランド統一は本フェーズ対象外、要責任者判断として`UI_REDESIGN_PLAN.md`未決事項に記載） |
| `color-accent-hover` | 強調色hover | `--accent-hover` | 個別実装 | ― |
| `color-accent-text` | 強調色上の文字 | `--accent-text` | white固定 | ― |
| `color-accent-soft` | 強調色の淡色版 | `--accent-soft` | `linen`（`#F8F5F0`） | ― |
| `color-status-success` | 成功 | `--success` | `text-green-*`/`bg-green-50` | Hub側は`bg-green-50 text-green-800`のペア値を1トークン化する候補 |
| `color-status-warning` | 警告 | `--warning` | 未整理（個別`text-yellow-*`等） | ― |
| `color-status-danger` | エラー/危険 | `--danger` | `text-red-*`/`bg-red-50` | ― |
| `color-status-info` | 情報 | `--info` | 未整理 | ― |
| `color-focus-ring` | フォーカスリング | `--focus-ring` | Tailwind標準`focus:ring`（明示トークンなし） | Hub側に明示トークン新設を推奨（アクセシビリティ監査の起点） |

Canvas専用色（Desktop `MangaCanvas.tsx`のKonva描画）は`color-canvas-*`のサブカテゴリとして分離し、上記の`color-status-*`と値を同期させる（例: 選択線は`color-canvas-selection` = `color-status-success`と同値）。

### 2.2 間隔（Spacing）

現状、両製品ともスケールの明文化がない（Desktopは`styles.css`内に個別px値、Hubは素のTailwindデフォルトスケールを無秩序に使用）。案:

| トークン名 | 値（案） | 用途 |
| --- | --- | --- |
| `space-1` | 4px | アイコンと文字の間隔等、最小単位 |
| `space-2` | 8px | フォーム要素内の細かい余白 |
| `space-3` | 12px | ボタン内padding等 |
| `space-4` | 16px | カード内padding、標準的な要素間隔 |
| `space-5` | 24px | セクション間 |
| `space-6` | 32px | 画面上下の大きな余白 |
| `space-8` | 48px | ページ区画の分離 |

Hubは既存Tailwindスケール（4px刻み）と親和性が高いためそのまま採用可能。Desktopは`styles.css`のリファクタ時に上記スケールへ寄せる。

### 2.3 タイポグラフィ（Typography）

| トークン名 | 用途 | Desktop現状 | Hub現状 |
| --- | --- | --- | --- |
| `font-family-base` | 本文 | `Inter, "Yu Gothic UI", "Noto Sans JP", sans-serif`（`styles.css:3`、1箇所のみ定義済み） | Tailwind既定（`font-sans`、要確認） |
| `font-size-xs`〜`font-size-2xl` | 段階的文字サイズ | 未トークン化（個別px値） | Tailwindユーティリティ（`text-sm`等）はあるがカスタムスケールなし |
| `font-weight-regular`/`medium`/`bold` | 太さ | 未トークン化 | Tailwind既定 |

Desktop側は既に単一箇所でfont-family定義済み（重複なし、良好）。文字サイズのスケール化が両製品共通の未着手課題。

### 2.4 形状・効果（Radius / Shadow / Motion）

| トークン名 | 用途 | Desktop現状 | Hub現状 |
| --- | --- | --- | --- |
| `radius-sm`/`md`/`lg` | 角丸 | 個別px値散在 | Tailwind既定＋`rounded-full`のpill多用 |
| `shadow-panel` | パネルの影 | `--shadow-panel`定義済み | `boxShadow.soft`定義済み | 命名を揃えるのみ |
| `shadow-dialog` | ダイアログの影 | `--shadow-dialog`定義済み | 未定義（新設要） |
| `motion-duration-fast`/`base` | トランジション速度 | 個別値、`prefers-reduced-motion`で0化 | 個別値 |

---

## 3. コンポーネント設計案

`CURRENT_UI_AUDIT.md`§4のコンポーネント化候補に対応するAPI設計方針。**設計方針のみ。実装は承認後、画面単位で着手する。**

### 3.1 共通API設計思想（DesktopとHubで概念を揃える）

| コンポーネント | variant/props（案） | 参照すべき既存実装 |
| --- | --- | --- |
| `Modal` / `Dialog` | `size: "sm"\|"md"\|"lg"`, `onClose`, `initialFocusRef`, `closeOnBackdrop` | Desktop 4箇所の既存focus trap実装を統合。特に`ExportDialog.tsx`が最も完成度が高く土台に適する |
| `Card` | `variant: "default"\|"interactive"\|"elevated"` | Desktop `.panel-lite`、Hub `.panel` |
| `FormField` | `label`, `error?`, `hint?`, `required?` | 両製品の手書きlabel+input群 |
| `EmptyState` | `icon?`, `title`, `description?`, `action?` | Hub既存`EmptyState.tsx`を土台にDesktop版を新設 |
| `StatusBadge`/`StatusPill` | `tone: "neutral"\|"info"\|"success"\|"warning"\|"danger"` | Desktop既存`StatusBadge.tsx`の5トーンをHub`StatusPill`にも適用 |
| `Button` | `variant: "primary"\|"secondary"\|"danger"`, `size: "sm"\|"md"` | 両製品ともボタン用React componentが存在しないため新設 |

### 3.2 Desktop固有コンポーネント（新設候補）

- `SettingsShell`: `AISettings`/`HubStatus`/`UpdateControl`を1つのタブ構造にまとめるシェル（既存`Tabs.tsx`を再利用）
- `useFocusTrap(ref, { onEscape, restoreFocusTo })`: 4箇所の重複focus trapをフック化
- `usePolling(fn, intervalMs)`: 3箇所の重複pollingをフック化
- `canvas-palette.ts`: Konva描画色をCSS変数値と同期させる定数モジュール

### 3.3 Hub固有コンポーネント（新設候補）

- `PageHeader`: タイトル+説明+主操作ボタンの共通ヘッダー
- `RowCard`/`ListItem`: サムネイル+テキスト+操作の行カード
- `DataTable`: テーブルシェル（ヘッダー、空状態、レスポンシブ折返し方針込み）
- `FlashMessage`: 成功/エラーインラインメッセージ（23ファイルの重複を解消）
- `ResultPanel`: checkout成功/キャンセル等の中央寄せCTAパネル
- `BackLink`: 一覧への戻りリンク（現状一部画面のみに存在する不統一を解消）
- 区画別`layout.tsx`（`dashboard/layout.tsx`、`admin/layout.tsx`、`creator/layout.tsx`）: adminナビ・パンくずの土台

---

## 4. 命名規則まとめ

- トークン: `{category}-{role}-{variant?}`（例: `color-status-danger`、`space-4`、`radius-md`）
- コンポーネントprops: `variant`（見た目のバリエーション）、`tone`（状態の意味づけ、成功/警告/エラー等）、`size`を区別して使う。「見た目」と「意味」を混同しない。
- 既存のDesktop `StatusBadge`が採用する5トーン命名（`neutral`/`info`/`success`/`warning`/`danger`）を、今後追加する全コンポーネントの`tone`命名の正本とする。

---

## 5. 未決事項（責任者判断が必要）

1. ~~Desktop（紫系アクセント`#6848d8`）とHub（緑系アクセント`#3F7D58`）のブランドカラーを統一するか~~ → **2026-07-26責任者指示により確定**: 統一しない。Desktopは紫系アクセントとダークテーマを維持する。Hub側の配色方針は、Hubのデザイン実装がDesktop確定後になるため、引き続き未決のまま据え置く。
2. Hubにダークモードを追加するか（Desktopは既にダーク固定のため、両製品でテーマ切替の要否が異なる）。Hubのデザイン実装がDesktop確定後になるため、未決のまま据え置く。
3. ~~Desktop側のCSS基盤をCSS変数のまま拡張するか、Hubと同様にTailwindへ移行するか~~ → **2026-07-26責任者指示により確定**: 移行しない。Desktopは既存のプレーンCSS＋CSS変数基盤を維持する。
4. フォントファミリーをMANGAIブランドとして統一するか（現状Desktop/Hubで別々の指定）。Hub側方針が未決のため、この項目も未決のまま据え置く。

Desktop側の画面別ビジュアル仕様（ワイヤーフレーム、コンポーネント仕様、レスポンシブ配置、状態別仕様、アクセシビリティ要件）は[`UI_REDESIGN_PLAN.md`](UI_REDESIGN_PLAN.md)の「Phase D0.5」を参照。実装着手前に、Phase D0.5内の各画面の「デザイン承認条件」について責任者の承認を得る。承認されるまで、本文書のトークン値・Phase D0.5の仕様は「案」として扱い、コード上のCSS変数/Tailwind設定・Reactコンポーネントは書き換えない。
