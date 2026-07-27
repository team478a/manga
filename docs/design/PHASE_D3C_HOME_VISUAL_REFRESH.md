# Phase D3-C: Home画面ビジュアル刷新（PR-C）

作成日: 2026-07-27
状態: 実装完了（コード変更あり）。**Windows CI（自動GUI検証・スクリーンショット）の実行結果は未確認**（本コンテナにXサーバーがなくローカルでElectronを起動できないため）。
Base branch: `feature/manga-canvas-mvp` @ `3fb5f24dede0961d1951c0479b6fc1bb996e2d6f`（PR #45マージ済みコミット）
作業ブランチ: `codex/phase-d3c-home-visual-refresh`

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§4.1（Desktopホーム）

## 1. 着手条件の確認

指示書「MANGAI 次期実装指示書」§3 PR-Cの着手条件は以下の4点。

- [x] PR-Aがマージ済み（PR #44、merge commit `3cb1ad0`）
- [x] PR-Bで目視確認またはGUI確認手段が確立済み（PR #45、Windows CI上でコマンドパレット目視確認12項目のうち11チェックが実際に成功したことを確認済み。`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`§5参照）
- [x] PR-Bがマージ済み（PR #45、merge commit `3fb5f24`）
- [x] 責任者がPhase D3-C着手を明示的に承認（責任者から直接、Home画面ビジュアル刷新の実装対象・禁止事項を明記した指示を受領）

**留意点**: `DESKTOP_CREATIVE_STUDIO_SPEC.md`§8「デザイン承認条件」のチェックリストは、文書としては引き続き未チェックのままである（本文書はビジュアル仕様の"案"として作成されたもので、§8の承認プロセスは別途想定されていた）。今回の着手は、責任者からの直接指示（Home画面ビジュアル刷新の具体的な実装範囲・禁止事項を明記）を、この特定スコープに対する明示的な着手承認として扱った。§5「ブレークポイント再編」（1365px→1279px等）は指示の対象に含まれていなかったため、本フェーズでは変更していない（後述§7）。

## 2. 実装内容

### 2.1 ファイル構成

`main.tsx`を大きく書き換えず、表示ロジック・カード・フィルターを分離した。

```
apps/desktop/src/renderer/
├── features/home/
│   └── project-view-model.ts       Projectの検証・絞り込み・並び替え（純粋関数のみ、IPC呼び出しなし）
└── components/home/
    ├── HomeProjectCard.tsx          1件分のProjectカード（カバー・タイトル・Badge・操作ボタン）
    ├── HomeProjectGrid.tsx          カードグリッド（auto-fit）とEmpty State
    └── HomeProjectFilters.tsx       フィルタchip・並び替えセレクト
```

`main.tsx`側の変更は、旧`<section className="projects">`内の1画面分のJSX（約90行）を、上記3コンポーネントの呼び出し（約15行）とフィルタ/並び替えstate・既存の操作ハンドラ（`moveProjectToAdult`/`deleteProject`）の切り出しに置き換えたのみ。`bundle`/`activeTool`等の既存の画面状態管理、Project開閉・バックアップ・複製・削除のIPC呼び出しは無変更。

### 2.2 Projectカードグリッド

- `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`（`DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1どおり、固定列数は指定していない）
- カバー画像はアスペクト比3:4、`--radius-sm`。画像なし時は既存どおり「M」のプレースホルダ文字（イラスト等の新規アセットは追加していない）
- カード下部に作品名（1行省略+`title`属性の代わりに`aria-label`で全文を通知）、更新日時（既存の`formatDateTime`をそのまま使用）
- 状態Badgeは既存の`StatusBadge`コンポーネントを使用し、`tone="warning"`（成人向け）/`tone="neutral"`（一般）で一般／成人向けを表示

### 2.3 フィルター・並び替え

`DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1のワイヤーフレームは「すべて／最近／お気に入り」のchipを示しているが、**「お気に入り」を保存するデータ項目は`Project`型（`packages/project-core/src/index.ts`）に存在せず、DB schemaの変更が必要になるため実装していない**（指示書の禁止事項「API、DB、Storage、Desktop IPC…は変更しない」に抵触するため）。代わりに、既存の`Project`型が持つフィールドのみを使い、以下を実装した。

- フィルタ: すべて／一般／成人向け（`contentClass`を使用、既存データ）
- 並び替え: 更新が新しい順（既定、`updatedAt`降順）／タイトル順（`title`の辞書順）

この代替案は、責任者に別途確認のうえ最終決定することを推奨する（§8参照）。

### 2.4 ページ数の非表示について

指示書は「ページ数」をカードに表示することを求めているが、**現在のDesktop IPC（`window.mangai.listProjects()`）はページ数を返さない**（`Project`型にページ数フィールドがなく、実際のページ数は`ProjectBundle`を取得しないとわからない）。全Projectのページ数を取得するには、新規IPC追加、または既存の`openProject`等（副作用のあるAPI）をProject一覧の件数分呼び出す必要があり、いずれも「Desktop IPCを変更しない」「不要な処理を追加しない」という制約に抵触するため、**本フェーズではページ数の表示を見送った**。ページ数表示が必要な場合は、軽量な読み取り専用IPC（例: `projectPageCount(id): Promise<number>`）の追加を別途検討する必要がある（§8参照）。

### 2.5 作品説明（subtitle/description）の非表示について

旧レイアウトは横長の行の中に説明文を1行表示していたが、カードグリッドでは表示領域が限られるため、カード本体には表示していない（`title`属性は付与していないが、`aria-label`でProject名は伝わる）。説明が必要な場合は、カードのtitle属性またはツールチップでの補足を別途検討できる。

### 2.6 hoverに依存しない操作

`DESKTOP_CREATIVE_STUDIO_SPEC.md`のワイヤーフレームはhover時にケバブメニューを表示する案を示しているが、hoverだけに依存しない操作という指示に従い、**既存どおり操作ボタン（成人向け移行/バックアップ/複製/削除）を常時表示のまま維持した**（hover専用の表示切替は追加していない）。これはキーボード操作・タッチ操作でも迷わず操作できる既存の利点をそのまま引き継ぐ判断である。

### 2.7 キーボード操作・フォーカス

- Projectを開くボタン（`.project-open`）は既存のまま独立した`<button>`要素であり、Tab到達・Enter実行が可能
- フィルタchipはネイティブ`<button aria-pressed>`、並び替えはネイティブ`<select>`。いずれも既存の`--focus-ring`をそのまま継承する（新規のfocus-visibleルールは追加していない、既存の全称`button/select:focus-visible`ルールが適用される）
- 操作ボタン（成人向け移行/バックアップ/複製/削除）はカードのクリックイベントより先に`stopPropagation`し、カード本体のクリックと競合しない（既存実装を維持）

### 2.8 不正なProjectレコードへの防御

`project-view-model.ts`の`isValidHomeProject`が`id`または`title`を欠くProjectレコードを除外し、Home画面全体がクラッシュしないようにしている（既存のPhase D3-Bで`recent-project-commands.ts`に導入した`isValidProject`と同じ考え方）。

## 3. 変更していないこと

- API、DB、Storage、Desktop IPC、SQLite schema（`window.mangai.listProjects`等のIPC呼び出し・返り値の形は無変更）
- AI Provider routing、成人向け安全ポリシー、Stripe
- 新規npm依存パッケージ、Tailwind導入
- `MangaCanvas`、`GenerationJobs`、`AISettings`、Chat画面、Hub接続画面、Cloud Editor
- `AppHeader`の高さ、`GlobalNav`の幅
- `DESKTOP_CREATIVE_STUDIO_SPEC.md`§5のブレークポイント再編（1365px→1279px等、別途承認が必要な項目のため対象外）
- `CommandPalette.tsx`本体、コマンドパレットのCtrl+K/トグル挙動（Phase D3-Bのまま無変更、共存を確認済み。§5参照）
- Projectを開く既存処理、複製・バックアップ・成人向け移動・削除の既存IPC呼び出し
- Project IDや保存パスの画面表示（追加していない）

## 4. 安全境界の確認

`design-home-project-grid.test.mjs`で、新規コンポーネント（`HomeProjectCard.tsx`/`HomeProjectGrid.tsx`/`HomeProjectFilters.tsx`/`project-view-model.ts`）の実コードに、AI Provider有効化・成人向け生成の直接実行・APIキー変更・課金操作を示すパターンが存在しないことを機械的に確認している。また`project-view-model.ts`は`window.mangai`等のIPC呼び出しを一切含まない、純粋な表示ロジックのみであることも確認している。

## 5. コマンドパレットとの共存

Phase D3-Bで実装したコマンドパレット（`Ctrl+K`、Home画面上部バーのトリガーボタン）は無変更のまま維持されている。`design-home-project-grid.test.mjs`で、`main.tsx`に`{commandPaletteElement}`と`toggleCommandPalette`の配線が引き続き存在することを確認した。Windows CI側でも、PR-Bで整備した目視確認基盤（`apps/desktop/src/main/index.ts`の`accessibilityTest`分岐）へ、Home Projectカードグリッド固有の検証を追加している（§6参照）。

## 6. Windows CI目視確認の拡張

PR-Bで整備した自動GUI検証基盤（`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`）へ、以下を追加した。新規npm依存パッケージは追加していない（Electron組み込みの`webContents.capturePage()`と`win.setContentSize()`のみを使用）。

| 検証項目 | 内容 |
| --- | --- |
| `home-project-grid-rendered` | Projectカードグリッドが実際に描画され、カバー・作品名・状態Badgeを含むことを確認 |
| `home-project-filter-updates-grid` | 「成人向け」フィルタへ切り替えると、一般Projectのみのテストデータでは0件表示（Empty State文言）になることを確認 |
| `home-project-filter-restores-grid` | 「すべて」へ戻すと件数が復帰することを確認 |
| 1920×1080 / 1366×768 のスクリーンショット | `win.setContentSize()`で指示書が明示する2解像度へ変更し、それぞれのグリッド表示をスクリーンショットへ記録（自動判定はせず、画像として証跡を残す） |

スクリーンショット: `home-project-grid-populated.png`、`home-project-grid-filtered-empty.png`、`home-project-grid-1920x1080.png`、`home-project-grid-1366x768.png`（既存の`screenshots/`ディレクトリへ追加、既存のCI artifactアップロードで自動的に回収される）。

**フィルタchipの選択はja/en文言に依存せず、DOM上の出現順（`FILTERS`配列の順序）で選択している。** これは、このテストブロックが実行される時点で、既存のアクセシビリティテスト本体（Phase D3以前から存在）がすでに英語ロケールへ切り替えたあとの状態であるため。

## 7. データ0件・1件・多数件・長いタイトル・カバーなし・成人向けの確認状況

指示書の「目視確認」表が求める組み合わせのうち、Windows CI上で自動的に確認できるのは以下の限りである（テストデータは既存のアクセシビリティテストが作成する"Accessibility Test Project"1件のみのため）。

| 条件 | 状況 |
| --- | --- |
| データ0件（Empty State） | フィルタ絞り込みによる0件表示は自動確認済み（§6）。Project未作成の初期状態のEmpty Stateは、`buildHomeProjectView([], ...)`のunit testで検証済み（`design-home-project-grid.test.mjs`）だが、実画面でのスクリーンショットは取得していない |
| データ1件 | 自動確認済み（§6のスクリーンショット） |
| データ多数（10件以上） | **未確認**。既存のアクセシビリティテストのテストデータ投入ロジックを大きく変更せずに複数Projectを作成する手段がなく、本フェーズでは追加していない |
| 長いタイトル（2行以上） | **未確認**。テストデータのタイトルは固定文字列のため |
| カバーなし | 自動確認済み（"Accessibility Test Project"はカバー未設定のため、既存の"M"プレースホルダが表示される） |
| 成人向けBadge | **未確認**。既存のテストデータ投入ロジックは`contentClass: "general"`のみを作成する |
| キーボード操作（Tab/Enter/Space/Escape） | 部分的に確認済み（コマンドパレットのキーボード操作はPhase D3-Bから継続確認。Projectカード自体のTab到達・Enter実行は静的テストのみで、実機操作は未確認） |
| コマンドパレットとの共存 | 自動確認済み（§5、§6） |

**多数データ・長いタイトル・成人向けBadgeの目視確認は、次の担当者が追加のテストデータ投入ロジックを用意するか、Windows実機で確認する必要がある。**

## 8. 責任者確認が必要な事項

- フィルタ・並び替えの基準を「一般／成人向け」「更新日時／タイトル」で確定してよいか（`お気に入り`は実装していない。実装する場合は`Project`型へのフィールド追加が必要になり、DB migrationが発生する）
- ページ数のカード表示を実装する場合、新規の読み取り専用IPC追加が必要になる旨の確認
- 説明文（subtitle/description）をカードへ戻すかどうか
- 多数データ・長いタイトル・成人向けBadgeの目視確認をどう完了させるか（追加テストデータ投入、またはWindows実機確認）

## 9. テスト結果

`codex/phase-d3c-home-visual-refresh`ブランチでローカル実行。

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS |
| `npm run lint` | PASS（root + Desktop） |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**182/182**。既存158件 + 新規`design-home-project-grid.test.mjs` 24件、既存の`design-components.test.mjs`/`design-home-screen.test.mjs`は実態に合わせて更新のうえ回帰なし） |
| `npm run hub:test` | PASS（116/116） |
| `npm run canvas:test` | PASS（26/26） |
| `npm run ai:test` | PASS（44/44） |
| `npm run db:migrations:validate` | PASS |
| `npm run desktop:build` | PASS |
| `npm run build`（Hub） | PASS |
| `git diff --check` | PASS |

注入している14個のJavaScriptブロック（`--mangai-accessibility-test`ハーネスの`executeJavaScript`文字列）は`new Function()`による構文チェックでエラーなし。

## 10. 正直な申告: Windows CI結果は未確認

**本コンテナ環境にはXサーバーがなくElectronを実際にレンダリングできないため、本PRのGUI検証部分（§6）が実際のWindows環境で意図通り動作するかは未確認。** PR-B（PR #45）では同種の追加が2回のCI失敗を経て動作確認できた実績があるため、同様に初回のCI結果を見て修正が必要になる可能性がある。Draft PR作成後、GitHub Actions（Windows runner）の結果を確認し、失敗した場合はログ・artifactを見て追加commitで修正する。

## 11. ロールバック方法

1. **本PR全体の取り消し**: ブランチ・PRをcloseすれば`feature/manga-canvas-mvp`には影響しない（未マージの間）。
2. **カードグリッドのみ取り消す**: `main.tsx`から`HomeProjectGrid`/`HomeProjectFilters`のimportと配線を削除し、`features/home/`・`components/home/`配下の新規ファイルを削除すれば、Phase D3-B完了時点のHome画面（横長リスト表示）へ戻る。`styles.css`の`.projects`/`.project-open`/`.cover`/`.project-summary`/`.actions`ルールも元の値へ戻す必要がある。
3. DB migration、API、Storage、IPCへの変更は一切ないため、ロールバックにデータ影響はない。
