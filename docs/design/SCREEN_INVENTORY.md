# MANGAI 画面棚卸し（Screen Inventory）

調査日: 2026-07-26
対象ブランチ: `design/mangai-ui-refresh`（`handoff/codex-to-claude-20260725`から分岐）
調査範囲: `apps/desktop/src/renderer/`（MANGAI Desktop）、`src/app/`・`src/components/`（MANGAI Hub）

この文書は現状の画面・コンポーネントを列挙するリファレンスです。問題点や再設計方針は[`CURRENT_UI_AUDIT.md`](CURRENT_UI_AUDIT.md)・[`UI_REDESIGN_PLAN.md`](UI_REDESIGN_PLAN.md)を参照してください。

行数はこの調査時点（`design/mangai-ui-refresh`分岐直後）のスナップショットです。

## 1. MANGAI Desktop 画面一覧

ルーターは存在せず、`apps/desktop/src/renderer/main.tsx`内の状態（`activeTool`、`bundle`の有無）による条件分岐で画面が切り替わる。

| 画面 | ファイル | 行数 | 内容 | 備考 |
| --- | --- | --- | --- | --- |
| Project一覧（Home） | `main.tsx`内`App()`（一部、L380-470, L700-795） | ― | Project cardグリッド、言語切替、自動backup状態バナー、新規Project modal起動 | 独立コンポーネント化されていない |
| 新規Project modal | `main.tsx`内`App()`（一部、L472-700） | ― | タイトル/サブタイトル/説明/ジャンル/年齢区分/コンテンツ区分/読み方向/Canvasサイズ/DPI入力 | 独自のfocus trap実装（4箇所ある重複の1つ） |
| Project Workspaceシェル | `main.tsx`（L909-1086、`AppHeader`/`GlobalNav`/`ProjectPanel`/`MangaCanvas`/`InspectorPanel`/`ExportDialog`/`WorkspaceStatusControls`を合成） | ― | ワークスペース全体のgrid layout | `App()`自体が最大の複合コンポーネント（~30個のuseState） |
| Episode/Page/Asset browser（左パネル） | `components/app-shell/ProjectPanel.tsx` | 138 | Episode選択、Pageサムネイル、Asset gridへの委譲 | 小規模・焦点明確 |
| Asset browser grid | `components/assets/AssetBrowser.tsx` | 306 | Asset tile、filter、drag source | 中規模 |
| Project構造タブ | `components/project/ProjectStructureTab.tsx` | 253 | Episode/Pageの別視点構造表示 | 中規模 |
| **Manga Canvas Editor** | `features/manga-canvas/MangaCanvas.tsx` | **3305** | Konva Stage、コマ描画、レイヤースタック、吹き出し、縦横テキスト・ルビ、ツールバー（追加/レイアウト/表示）、grid/snap、プロパティパネル | **最大ファイル。God Component。約12個の内部sub-component** |
| 右Inspectorパネル | `components/app-shell/InspectorPanel.tsx` | 240 | Properties/Layers/AIタブのシェル（前2つはCanvasからのDOM portal host） | portal host構造がCanvas機能と密結合 |
| App Header（上部バー） | `components/app-shell/AppHeader.tsx` | 155 | breadcrumb、Undo/Redo、import/export、panel開閉、保存状態、`UpdateControl` | 小規模 |
| Global Nav（左アイコンレール） | `components/app-shell/GlobalNav.tsx` | 70 | editor/chat/jobs/hub/settingsの5アイコン | 小規模・良好な実装 |
| Status Bar（下部） | `components/app-shell/StatusBar.tsx` | 44 | パス/zoom/状態表示 | 小規模 |
| Workspace Status Controls | `components/app-shell/WorkspaceStatusControls.tsx` | 298 | Ollama/ComfyUI接続バッジ、生成Job一覧drawer | 独自のfocus trap実装 |
| Export Dialog | `components/app-shell/ExportDialog.tsx` | 278 | PDF/PNG-ZIP/販売パッケージ書き出し、進捗、履歴 | 独自のfocus trap実装 |
| **Creator Chat** | `features/creator-chat/CreatorChat.tsx` | 541 | セッション一覧、メッセージスレッド、テンプレート選択、prompt入力（docked/full screenの2レンダリング分岐） | `sessions`/`templates`が`any[]`型 |
| **画像生成Job（drawer＋Job UI）** | `features/generation-jobs/GenerationJobs.tsx` | **1828** | Prompt builder、Job queueテーブル、外部dispatch確認dialog、workflow選択、character profile連携、library asset browsing | **2番目に大きいGod Component。独自focus trap** |
| Character Profile Manager | `features/generation-jobs/CharacterProfileManager.tsx` | 237 | 再利用キャラクタープロフィールCRUD | 中規模 |
| Project Generation Policy Settings | `features/generation-jobs/ProjectGenerationPolicySettings.tsx` | 200 | Project別のlocal/外部生成route規則、sensitivity flag | 中規模 |
| **Settings（AI Provider設定）** | `features/ai-settings/AISettings.tsx` | **1082** | Ollama/ComfyUI provider card、診断、runtime profile、workflow設定、テンプレート、Dezgo・Adult設定を合成 | 多関心事、Dezgo/Adultをsub-panelとして合成 |
| Dezgo設定 sub-panel | `features/ai-settings/DezgoSettings.tsx` | 266 | Dezgo APIキー・モデル・adult flag設定 | 中規模 |
| Adult生成設定 sub-panel | `features/ai-settings/AdultGenerationSettings.tsx` | 217 | 成人向け生成policy切替 | 中規模 |
| Hub連携・端末認証 | `features/hub-status/HubStatus.tsx` | 387 | 端末ペアリング/認証フロー、公開URL共有、同期状態 | 中規模 |
| Update Control | `features/updater/UpdateControl.tsx` | 104 | 更新チャンネル選択、確認・適用ボタン（`AppHeader`とHome双方に埋め込み） | 小規模 |
| App Root/Skip link | `main.tsx`（`AppRoot()`、L1124-1134） | ― | skip link、`ToolShell`ラッパー | ― |
| （共通）Status Badge | `components/common/StatusBadge.tsx` | 24 | tone付きstatusバッジ、`aria-live` | 既存の共有コンポーネント |
| （共通）Tabs | `components/common/Tabs.tsx` | 70 | ARIA tablist完全実装、roving tabindex | 既存の共有コンポーネント。再利用推奨 |
| スタイル一括ファイル | `styles.css` | 2463 | 全画面のCSSがこの1ファイルに集約 | design tokenは`:root`のCSS変数として整備済み |
| i18n辞書 | `i18n.tsx` | 2416 | ja/en 2辞書、`I18nProvider`/`useI18n` | 全画面が依存する唯一の翻訳ソース |

初回起動（オンボーディング）専用画面はなし。Project一覧の空状態（`.empty`クラス、`home.none`キー）が実質的な初回体験。

### Desktop 大きいファイルTop5

| 順位 | ファイル | 行数 |
| --- | --- | --- |
| 1 | `features/manga-canvas/MangaCanvas.tsx` | 3305 |
| 2 | `i18n.tsx` | 2416 |
| 3 | `features/generation-jobs/GenerationJobs.tsx` | 1828 |
| 4 | `main.tsx` | 1142 |
| 5 | `features/ai-settings/AISettings.tsx` | 1082 |

## 2. MANGAI Hub 画面一覧

Next.js App Router。ルートグループ・区画別layoutは存在せず、`src/app/layout.tsx`（21行）1枚のみが全画面（公開/dashboard/admin/creator）に適用される。

| Route | ファイル | 行数 | 内容 | 備考 |
| --- | --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | 45 | マーケティングhome/hero | ― |
| `/login` | `src/app/login/page.tsx` | 25 | サインインフォーム | ― |
| `/signup` | `src/app/signup/page.tsx` | 29 | 登録フォーム | ― |
| `/works` | `src/app/works/page.tsx` | 158 | 公開作品一覧・検索・タグ絞り込み | ― |
| `/works/[id]` | `src/app/works/[id]/page.tsx` | 121 | 作品詳細＋商品一覧 | ― |
| `/dashboard` | `src/app/dashboard/page.tsx` | 181 | クリエイターhome（12カードnav grid＋profileフォーム） | ― |
| `/dashboard/works` | `src/app/dashboard/works/page.tsx` | 64 | 自分の作品一覧 | ― |
| `/dashboard/works/new` | `src/app/dashboard/works/new/page.tsx` | 129 | 作品作成フォーム | ― |
| `/dashboard/works/[id]/edit` | `src/app/dashboard/works/[id]/edit/page.tsx` | 85 | 作品編集フォーム | ― |
| `/dashboard/products` | `src/app/dashboard/products/page.tsx` | 74 | デジタル商品一覧 | ― |
| `/dashboard/products/new` | `src/app/dashboard/products/new/page.tsx` | 87 | 商品作成フォーム | ― |
| `/dashboard/products/[id]/edit` | `src/app/dashboard/products/[id]/edit/page.tsx` | 94 | 商品編集フォーム | ― |
| `/dashboard/sales` | `src/app/dashboard/sales/page.tsx` | 65 | 注文/売上テーブル | ― |
| `/dashboard/purchases` | `src/app/dashboard/purchases/page.tsx` | 81 | 購入履歴・再ダウンロード | ― |
| `/dashboard/billing` | `src/app/dashboard/billing/page.tsx` | 110 | Cloud AI plan/credit、Stripe portal/checkoutフォーム | ― |
| `/dashboard/devices` | `src/app/dashboard/devices/page.tsx` | 98 | Desktop端末連携一覧・失効 | ― |
| `/dashboard/devices/authorize` | `src/app/dashboard/devices/authorize/page.tsx` | 89 | 端末ペアリングコード承認 | ― |
| `/dashboard/goods-requests` | `src/app/dashboard/goods-requests/page.tsx` | 81 | グッズ申請一覧 | ― |
| `/dashboard/goods-requests/new` | `src/app/dashboard/goods-requests/new/page.tsx` | 68 | グッズ申請フォーム | ― |
| `/dashboard/notifications` | `src/app/dashboard/notifications/page.tsx` | 12 | 通知一覧（薄いwrapper） | ― |
| `/dashboard/import-package` | `page.tsx`(27) + `SalesPackageImport.tsx` | 27+**493** | 販売パッケージZIPの検証・import UI（client） | **God Component候補**。ZIP解析・manifest検証・hash・preview・uploadが1ファイル |
| `/creator` | `src/app/creator/page.tsx` | 96 | Cloud Creator Project一覧 | ― |
| `/creator/new` | `src/app/creator/new/page.tsx` | 127 | 新規Projectフォーム | ― |
| `/creator/trash` | `src/app/creator/trash/page.tsx` | 61 | 削除済みProject | ― |
| `/creator/[projectId]` | `src/app/creator/[projectId]/page.tsx` | **417** | Episode/Pageツリー、名称変更/移動/削除、marketplace同期 | 構造管理・複数フォーム・同期処理が1ファイル |
| `/creator/[projectId]/pages/[pageId]` | `page.tsx`(48, server) + `CloudCanvasEditor.tsx`(**1379**, client) | 48+1379 | **Cloud Canvas Editor**（DOM/SVGベース、`@mangai/canvas-core`のデータモデルを使用） | **アプリ全体で最大のファイル。God Component** |
| `/checkout/[productId]` | `src/app/checkout/[productId]/page.tsx` | 93 | 商品購入・注文作成 | ― |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | 85 | 決済後確認＋期限付きdownload URL | ビジネスロジックがpageファイルに直書き |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | 66 | キャンセル確認 | ― |
| `/admin` | `src/app/admin/page.tsx` | 52 | 管理KPIダッシュボード | ― |
| `/admin/users` | `src/app/admin/users/page.tsx` | 63 | ユーザーテーブル | ― |
| `/admin/users/[id]` | `src/app/admin/users/[id]/page.tsx` | 66 | ユーザー詳細 | ― |
| `/admin/works` | `src/app/admin/works/page.tsx` | 57 | 全作品レビュー一覧 | dashboard/worksとほぼ同一markup |
| `/admin/products` | `src/app/admin/products/page.tsx` | 53 | 全商品テーブル | ― |
| `/admin/orders` | `src/app/admin/orders/page.tsx` | 41 | 注文テーブル | ― |
| `/admin/goods-requests` | `src/app/admin/goods-requests/page.tsx` | 100 | グッズ申請レビュー＋状態/メモフォーム | ― |
| `/admin/cloud-ai` | `page.tsx`(76) + `actions.ts`(191) | 76+191 | Cloud AI運用コンソール（設定/plan/価格/コスト/失敗Job/監査ログ/通知） | **品質面の外れ値**。1行に圧縮されたJSX、`any`型多用 |
| `/sales-packages` | `page.tsx`(206) + `actions.ts`(64) | 206+64 | 旧ローカル販売パッケージ機能（本番既定無効） | 大きめフォーム |

共有コンポーネント（`src/components/`）は3個のみ:

| コンポーネント | ファイル | 行数 | 用途 |
| --- | --- | --- | --- |
| Header | `src/components/Header.tsx` | 56 | 全画面共通の唯一のnavバー（公開/dashboard/admin/creator区別なし） |
| WorkCard | `src/components/WorkCard.tsx` | 30 | 公開作品grid card（`/works`でのみ実質使用） |
| EmptyState | `src/components/EmptyState.tsx` | 25 | 汎用空状態パネル（一部画面のみ採用） |

App Router UIコード合計: 約3,212行（30ファイル）。`CloudCanvasEditor.tsx`が全体の約43%を占める。

### Hub 大きいファイルTop5

| 順位 | ファイル | 行数 |
| --- | --- | --- |
| 1 | `src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx` | 1379 |
| 2 | `src/app/dashboard/import-package/SalesPackageImport.tsx` | 493 |
| 3 | `src/app/creator/[projectId]/page.tsx` | 417 |
| 4 | `src/app/sales-packages/page.tsx` | 206 |
| 5 | `src/app/dashboard/page.tsx` | 181 |

## 3. Desktop横断でGod Component化している画面（優先調査対象）

1. `apps/desktop/src/renderer/features/manga-canvas/MangaCanvas.tsx`（3305行）
2. `apps/desktop/src/renderer/features/generation-jobs/GenerationJobs.tsx`（1828行）
3. `apps/desktop/src/renderer/main.tsx`（1142行、Home＋新規Project modal＋Workspaceシェルを1つの`App()`が保有）
4. `apps/desktop/src/renderer/features/ai-settings/AISettings.tsx`（1082行）

## 4. Hub横断でGod Component化している画面（優先調査対象）

1. `src/app/creator/[projectId]/pages/[pageId]/CloudCanvasEditor.tsx`（1379行）
2. `src/app/dashboard/import-package/SalesPackageImport.tsx`（493行）
3. `src/app/creator/[projectId]/page.tsx`（417行）

詳細な問題点・重複・コンポーネント化候補は[`CURRENT_UI_AUDIT.md`](CURRENT_UI_AUDIT.md)を参照。
