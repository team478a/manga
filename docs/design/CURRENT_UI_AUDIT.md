# MANGAI 現状UI監査（Current UI Audit）

調査日: 2026-07-26
調査ブランチ: `design/mangai-ui-refresh`
調査方法: `apps/desktop/src/renderer/`と`src/app/`・`src/components/`をそれぞれ独立したread-only調査で走査（コード変更なし）。画面一覧の生データは[`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md)を参照。

この文書はデザイン刷新の前提となる「現状把握」です。実装方針・優先順位は[`UI_REDESIGN_PLAN.md`](UI_REDESIGN_PLAN.md)、トークン設計は[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)を参照してください。

---

## 1. 現在のUI構造（要約）

### MANGAI Desktop（Electron + React 19）

- ルーティングライブラリなし。`apps/desktop/src/renderer/main.tsx`内`App()`の状態（`activeTool: "chat"|"settings"|"jobs"|"hub"|null`、`bundle`の有無）による条件分岐で画面を切替。
- 永続シェル: `AppHeader`（上部）＋`GlobalNav`（左アイコンレール）＋`StatusBar`（下部）。ただし`ToolShell`経由のchat/settings/jobs/hub画面は`AppHeader`/`StatusBar`を持たず、`GlobalNav`のみのシェルになる（シェルが統一されていない）。
- スタイル: Tailwindなし。単一の`styles.css`（2463行）＋CSS変数によるdesign token（`--bg-app`、`--accent`、`--success`等）。コンポーネント側での`style={{}}`インライン指定はゼロ。
- テーマ: ダーク固定（`:root { color-scheme: dark; }`）。ライトテーマ・切替UIなし。`forced-colors`（Windows High Contrast）と`prefers-reduced-motion`は対応済み。
- i18n: `i18n.tsx`（2416行）1ファイルにja/en辞書を直書き。ロケールごとのJSON分割やライブラリ（`next-intl`等）は未使用。
- 左右パネルの開閉状態は`localStorage`永続化、初期値は`window.innerWidth`依存。1365px以下で右パネルがoverlay drawer化する「Canvas狭幅レイアウト」がCSS側で実装済み。

### MANGAI Hub（Next.js App Router）

- `src/app/layout.tsx`（21行）が唯一のlayoutで、公開/dashboard/admin/creatorのすべての画面に同一の`<Header/>`を適用。区画別のlayout.tsx、route group、admin専用nav、パンくずは存在しない。
- スタイル: Tailwind CSS。`tailwind.config.ts`にトークン拡張（`ink`/`leaf`/`linen`/`rose`＋`boxShadow.soft`）、`globals.css`の`@layer components`に`.page`/`.panel`/`.label`/`.field`/`.button`/`.button-secondary`/`.muted`の6ユーティリティクラス。
- テーマ: ライト固定（`:root { color-scheme: light; }`）。`dark:`バリアント・ThemeProvider・`prefers-color-scheme`いずれも未使用。
- i18n: 日本語固定（`<html lang="ja">`）。ロケール切替の仕組みはなし。
- 共有UIコンポーネントは`src/components/`に`Header.tsx`（56行）、`WorkCard.tsx`（30行）、`EmptyState.tsx`（25行）の3個のみ。約3,212行のページコードに対して極端に薄い。

---

## 2. 問題点

### 2.1 共通の問題（Desktop・Hub両方）

1. **God Component化**: 両製品とも「Canvas Editor」が突出して巨大（Desktop `MangaCanvas.tsx` 3305行、Hub `CloudCanvasEditor.tsx` 1379行）。Desktopはさらに`GenerationJobs.tsx`（1828行）、`main.tsx`（1142行）、`AISettings.tsx`（1082行）が続く。1ファイルが状態管理・業務ロジック・巨大なJSXツリーを同時に保有しており、デザイン変更時に見た目とロジックを安全に分離しにくい。
2. **Modal/Dialogの重複実装**: 共有`Modal`コンポーネントが存在せず、focus trap・Escapeクローズ・focus復帰を個別実装している（Desktop 4箇所、Hub 1箇所のみだが同様に非共有）。デザイン変更でmodalの見た目を統一するには、まずロジックの共通化が必要。
3. **カード/リスト行パターンの重複**: `<article>`をカードとして使う実装が両製品で複数箇所独立している（Desktop 7箇所以上、Hub 4箇所以上）。同じ見た目を意図しながらCSSが画面ごとに再定義されている。
4. **フォームフィールドの重複**: `<label>`+`<input>`の組み合わせを画面ごとに手書き。共有`FormField`/`Field`コンポーネントが両製品ともにない。
5. **ステータス表示ロジックの重複**: 状態→表示色/文言のマッピング関数が画面ごとに独立実装されている（Desktop: `savingTone()`、`connectionTone()`/`jobTone()`、`GenerationJobs.tsx`内の複数キー関数。Hub: 色分けが`admin/cloud-ai/page.tsx`にインライン）。

### 2.2 Desktop固有の問題

1. **Canvas EditorのDOM portal依存**: `InspectorPanel`の「Properties」「Layers」タブは実体を持たず、`MangaCanvas.tsx`がportal経由でDOMを注入する構造。Canvas機能とapp-shellが密結合しており、Inspector側だけを独立してデザイン変更するのが難しい。
2. **「設定」が3画面に分散**: `AISettings.tsx`（AI Provider）、`HubStatus.tsx`（Hub連携）、`UpdateControl.tsx`（更新チャンネル、`AppHeader`とHome双方に埋め込み）が別々の`ToolShell`ルートまたは埋め込みUIとして存在し、統一された設定タブ構造がない。
3. **Konva色とCSS変数の不整合**: `MangaCanvas.tsx`内のKonva描画色（例: 選択線`#2f9e68`、guide線）はCSS変数`--success`（`#37c77a`）等と同じ意味でも別パレットのハードコード値になっている。デザイントークン変更がCanvas描画色に反映されない。
4. **ポーリング実装の重複**: `WorkspaceStatusControls.tsx`（接続60秒/Job 2秒）、`HubStatus.tsx`（独自interval）、`main.tsx`（自動backup 15秒）がそれぞれ独立して`setInterval`を実装。
5. **単一巨大CSSファイル**: `styles.css`が433個のトップレベルセレクタを画面順に並べた1ファイル。特定画面のスタイルを探す・削除するコストが高い。

### 2.3 Hub固有の問題

1. **区画別レイアウトの不在**: 公開/dashboard/admin/creatorが同一の`<Header/>`のみを共有し、adminには管理画面へのnavリンクすら存在しない（`Header.tsx`に`/admin`へのリンクなし）。管理者はURLを直接知る必要がある。
2. **Cloud Canvas Editorの二重ヘッダー**: `CloudCanvasEditor.tsx`が独自の`sticky top-0`ヘッダーを持ちながら、ルートlayoutの`<Header/>`も表示され続けるため、編集画面でヘッダーが2段重ねになる。
3. **`admin/cloud-ai/page.tsx`の品質劣化**: 1行に圧縮された巨大JSX、`plan:any`/`price:any`/`job:any`等の型崩れ、7並列のデータ取得が1ファイルに集約。デザイン変更よりまず構造分割が必要な最劣化画面。
4. **アクセシビリティ属性の著しい偏在**: `aria-*`属性はほぼ`CloudCanvasEditor.tsx`と`creator/[projectId]/page.tsx`に集中し、dashboard/admin/公開/checkoutにはゼロ。スキップリンクもない。
5. **レスポンシブ戦略の不統一**: ブレークポイントの使い方が画面ごとにバラバラ（`sm:`+`lg:`のみの画面、`lg:grid-cols-3`直行の画面等）。Canvas Editorの3カラムlayoutは`xl:`未満でのフォールバックが実質未設計。

---

## 3. 重複しているデザイン実装（横断まとめ）

| パターン | Desktop出現箇所 | Hub出現箇所 |
| --- | --- | --- |
| Modal/Dialog + focus trap | `main.tsx`新規Project modal、`ExportDialog.tsx`、`WorkspaceStatusControls.tsx`、`GenerationJobs.tsx` の4箇所独立実装 | `CloudCanvasEditor.tsx`のpreview overlayのみ（focus trap・Escapeハンドラなし） |
| カード（`<article>`） | 7箇所以上（Project card、export option card、job card、message bubble、provider/template card） | 4箇所以上（work row、product row、admin work row、goods-request card） |
| フラッシュメッセージ（成功/エラー） | `.empty`クラス等、局所的 | 23ファイルで`bg-green-50`/`bg-red-50`パターンを個別実装 |
| ステータス/タグpill | `StatusBadge`は共有化済みだが、tone算出関数は3箇所以上で重複 | `rounded-full bg-linen px-3 py-1`パターンが9ファイルで重複 |
| データテーブル | ― | 6ファイルで`panel overflow-x-auto`+`<table>`パターンを個別実装 |
| フォームfield（label+input） | New Project modal、`AISettings`、`DezgoSettings`、`ProjectGenerationPolicySettings`、`HubStatus` | 20ファイル以上 |
| セクションカード（`.panel-lite`） | 9箇所以上（未コンポーネント化の共有CSSクラス） | ― |
| ページヘッダー（タイトル+説明+主操作ボタン） | ― | 6ファイル以上で同一flexパターンを個別実装 |

---

## 4. コンポーネント化候補

### 両製品共通で優先度が高いもの

1. `Modal`/`Dialog` + 共通`useFocusTrap`フック（Escapeクローズ、focus復帰を含む）
2. `Card`（variant/modifier対応の汎用カード）
3. `FormField`（label+input/select/textareaのラッパー、エラー表示込み）
4. `EmptyState`（Hubは既存、Desktopは`.empty`クラスのみ→コンポーネント化）
5. ステータス/toneマッピングの共通ユーティリティ（状態enumから色・文言を導出する1箇所の関数）

### Desktop固有

- `usePolling(fn, intervalMs)`共通フック（3箇所の重複`setInterval`を統合）
- 設定関連3画面（AI Provider/Hub連携/更新チャンネル）を束ねる`SettingsShell`＋タブ構造
- Canvas内の色定数を`--*`CSS変数から導出する橋渡し（Konva用パレットオブジェクト）

### Hub固有

- `PageHeader`（タイトル+説明+主操作ボタン）
- `StatusPill`
- `RowCard`/`ListItem`（サムネイル+テキスト+操作）
- `DataTable`シェル
- `FlashMessage`/`Alert`
- `ResultPanel`（checkout成功/キャンセル等の中央寄せCTAパネル）
- `BackLink`
- 区画別`layout.tsx`（`dashboard/`、`admin/`、`creator/`にそれぞれ配置し、Headerの出し分け・adminナビ・パンくずを実現）

---

## 5. DesktopとHubで共通化できる範囲

- **デザイントークンの構造（命名規則・カテゴリ分け）**: 色・spacing・typography・radius・shadowのカテゴリ分けとネーミング規約は共通化できる。ただし値そのもの（ダーク基調 vs ライト基調）は共通化しない（§6参照）。
- **コンポーネントAPI設計**: `Modal`/`Card`/`FormField`/`EmptyState`等のprops設計思想（variant名、サイズ名）は共通の考え方を採用できるが、実装は製品ごとに分離する（DesktopはプレーンCSS、HubはTailwindのため、コード共有はしない。設計ドキュメント・命名だけ共通化）。
- **アクセシビリティパターン**: focus trap、Escapeクローズ、`aria-live`の使い方、skip linkの考え方はDesktopに実装例がある（`Tabs.tsx`のARIA tablist実装は特に参考になる）。Hubはこのパターンをほぼ持たないため、Desktopの実装知見をHub側の設計に転用できる。
- **ステータス/tone命名**: 「neutral/info/success/warning/danger」の5値はDesktopの`StatusBadge`で既に採用されている。Hubのステータス表現もこの命名に揃えられる。

## 6. Desktop固有のUI

- ダークテーマ固定、Windows High Contrast（`forced-colors`）対応
- Konvaベースのcanvas描画（`react-konva`）、ピクセル精度のコマ・レイヤー・吹き出し編集
- 左アイコンレール型のGlobalNav（5アイコン、ツール切替）
- 3カラムワークスペース（左Asset/Episode/Page、中央Canvas、右Inspector）とその狭幅overlay化
- ネイティブ的な操作感（ショートカット、Undo/Redo、ドラッグ&ドロップimport）

## 7. Hub固有のUI

- ライトテーマ固定、Webブラウザでのレスポンシブ前提（ただしCanvas Editorは実質デスクトップ幅前提）
- 公開マーケットプレイス（`/works`、検索・タグ絞り込み、SEO的な公開ページ）
- Checkoutフロー（Stripe連携、注文状態遷移画面）
- Admin運用コンソール（ユーザー/作品/商品/注文/申請/Cloud AI管理）
- Server Actions中心のフォーム送信（クライアント側JSが薄い画面が多い）

---

## 8. 変更時に壊してはいけない機能

ユーザーからの明示的な禁止事項（本タスクの指示）に対応する、UI監査時点での具体的な「触れてはいけない実装」の一覧。

### 8.1 ビジネスロジック・データ層（変更禁止）

- Server Actions（`src/app/actions.ts`とその委譲先`src/app/actions/*.ts`）の入出力契約
- API Route（`src/app/api/**`）のrequest/response形式
- Supabase RLS、DB schema、migration（`supabase/`）
- Storage path命名規則、署名URLの発行ロジック
- Stripe Webhook処理、決済状態遷移
- Desktop IPC（`apps/desktop/src/preload/api.ts`とmain process側ハンドラ）のschema
- Desktop SQLite schema、`.mangai-backup`形式、`MangaiDatabase`facade
- Canvas保存処理（`useCanvasAutosave.ts`の再試行・revision競合ロジック、`panels`/`panel_layers`の永続化形式）
- AI生成ルーティング（Generation Router、safe/adult分類、fail-closed判定、外部Provider送信ポリシー）
- 認証・端末認可（Supabase Auth、Hub端末コード認証、`safeStorage`暗号化）
- Domain Error契約（`src/lib/domain-errors.ts`、`errorCode`）とredaction仕様（`src/lib/hub-logger.ts`）

### 8.2 UI側で保持すべき既存の非ビジュアル実装

- Desktop: skip link（`main.tsx`の`.skip-link`、`a11y.skipMain`キー）
- Desktop: `forced-colors`（Windows High Contrast）対応CSS
- Desktop: `prefers-reduced-motion`対応
- Desktop: `Tabs.tsx`のARIA tablist実装（roving tabindex、Arrow/Home/End）
- Desktop: i18n辞書のja/en両方の追加・キー整合（`i18n.tsx`のTypeScript型でキー一致が強制されている）
- Desktop: 左右パネルの`localStorage`永続化キー（`mangai.left-panel-open`、`mangai.right-panel-open`、`mangai.inspector-tab`）
- Desktop: `data-a11y-action`/`data-a11y-field`のテスト自動化フック
- Hub: `CloudCanvasEditor.tsx`の`aria-live`、`aria-modal`、`role="alert"`等の既存アクセシビリティ属性
- Hub: `sample_image_urls`等、公開ページで参照されるDB由来のフィールド名（コンポーネント分割時にpropsの受け渡しmiss防止）

### 8.3 テスト対象（デザイン変更後も通過必須）

- `npm run desktop:test`（98件、UI操作を含む統合テスト。ドラッグ&ドロップ、export、backup等）
- `npm run desktop:test:a11y`（axe監査、既存29状態で違反0件を維持）
- `npm run canvas:test` / `npm run ai:test`（UIではなくロジックだが、Canvas/AI画面のprops変更で壊れる可能性がある）
- `npm run hub:test`（Server Action・API・Domain Errorの回帰テスト。UIのみの変更でも呼び出しシグネチャ変更で壊れうる）

---

## 9. 次の文書

- 画面別の変更優先順位・段階的実装計画: [`UI_REDESIGN_PLAN.md`](UI_REDESIGN_PLAN.md)
- デザイントークン案・コンポーネント設計: [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)
- 生データ（画面一覧・行数）: [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md)
