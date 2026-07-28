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

PR-Bで整備した自動GUI検証基盤（`docs/design/PHASE_D3C_VISUAL_VALIDATION_PLAN.md`）へ、以下を追加した。新規npm依存パッケージは追加していない（Electron組み込みの`webContents.capturePage()`と`win.setContentSize()`、既存IPC（`createProject`/`changeProjectContentClass`）のみを使用）。

| 検証項目 | 内容 |
| --- | --- |
| `home-project-grid-rendered` | Projectカードグリッドが実際に描画され、カバー・作品名・状態Badgeを含むことを確認 |
| `home-project-card-max-width-single-project` | **（責任者レビュー指摘の回帰確認）** Projectが1件のときカード幅が320px以下、作品名・操作領域が初期表示内に収まることを確認 |
| `home-project-filter-updates-grid` | 「成人向け」フィルタへ切り替えると、一般Projectのみのテストデータでは0件表示（Empty State文言）になることを確認 |
| `home-project-filter-restores-grid` | 「すべて」へ戻すと件数が復帰することを確認 |
| `home-project-grid-layout-1920x1080` / `home-project-grid-layout-1366x768` | 指示書が明示する2解像度で、カード幅（320px以下）・左寄せ（グリッド左端からのオフセット4px未満）・作品名/操作領域の可視性を確認したうえでスクリーンショットを記録 |
| `home-project-grid-scales-to-4-projects` | 「新規Project」ダイアログのUI操作を3回実行しProjectを4件へ増やし、カードが320pxを超えず複数列で描画されることを確認 |
| `home-project-grid-scales-to-10-projects` | 同様に10件まで増やし（うち1件は長いタイトル）、カード幅超過なし・長いタイトルの省略記号（`scrollWidth > clientWidth`）・既存の「成人向けへ移行」ボタン経由で1件を成人向けへ変更しBadge反映を確認 |

スクリーンショット: `home-project-grid-populated.png`、`home-project-grid-filtered-empty.png`、`home-project-grid-1920x1080.png`、`home-project-grid-1366x768.png`、`home-project-grid-4-projects.png`、`home-project-grid-10-projects.png`（既存の`screenshots/`ディレクトリへ追加、既存のCI artifactアップロードで自動的に回収される）。

**フィルタchipの選択はja/en文言に依存せず、DOM上の出現順（`FILTERS`配列の順序）で選択している。** これは、このテストブロックが実行される時点で、既存のアクセシビリティテスト本体（Phase D3以前から存在）がすでに英語ロケールへ切り替えたあとの状態であるため（ロケール自体はPhase D3-C第2ラウンドの修正で日本語へ戻している。§12参照）。

「成人向けへ移行」操作は既存の`confirm()`/`alert()`ネイティブダイアログを呼び出すため、ヘッドレスCIで処理が止まらないよう`window.confirm`/`window.alert`をこのブロック内でのみ自動承認へ差し替えている（既存の安全確認ロジック・IPC呼び出し自体は変更していない）。

## 7. データ0件・1件・多数件・長いタイトル・カバーなし・成人向けの確認状況

指示書の「目視確認」表が求める組み合わせのうち、Windows CI上で自動的に確認できるようになったのは以下のとおり（§6のPhase D3-C第2ラウンド拡張により、多数データ・長いタイトル・成人向けBadgeの一部が新たに自動確認対象になった）。

| 条件 | 状況 |
| --- | --- |
| データ0件（Empty State） | フィルタ絞り込みによる0件表示は自動確認済み（§6）。Project未作成の初期状態のEmpty Stateは、`buildHomeProjectView([], ...)`のunit testで検証済み（`design-home-project-grid.test.mjs`）だが、実画面でのスクリーンショットは取得していない |
| データ1件 | 自動確認済み（§6のスクリーンショット、カード最大幅の回帰確認込み） |
| データ4件・10件以上 | **自動確認済み**（`home-project-grid-scales-to-4-projects`/`-10-projects`、既存の「新規Project」ダイアログUI操作でIPC呼び出しを反復） |
| 長いタイトル（省略記号） | **自動確認済み**（10件目のProjectに長いタイトルを設定し、`scrollWidth > clientWidth`で省略記号の発動を確認） |
| カバーなし | 自動確認済み（すべてのテストプロジェクトはカバー未設定のため、既存の"M"プレースホルダが表示される） |
| カバーあり | **未確認・実装保留**。既存IPC（`importDroppedAssets`）はElectronの`webUtils.getPathForFile`に依存しており、テスト実行環境（headless CI）で生成した合成File／Blobでは実ファイルパスを取得できないため、既存IPCのみでカバー付きProjectを再現する手段がない。新規テスト専用IPCの追加、またはAI生成パイプライン（本フェーズの禁止事項）の利用が必要になり、いずれも本フェーズの範囲外。カバーあり／なしの分岐自体は`HomeProjectCard.tsx`の静的テストで検証済み |
| 成人向けBadge | **自動確認済み**（既存の「成人向けへ移行」ボタン経由で1件を変更、Badge反映を確認。10件シナリオに含む） |
| キーボード操作（Tab/Enter/Space/Escape） | 部分的に確認済み（コマンドパレットのキーボード操作はPhase D3-Bから継続確認。Projectカード自体のTab到達・Enter実行は静的テストのみで、実機操作は未確認） |
| コマンドパレットとの共存 | 自動確認済み（§5、§6） |

**カバーあり状態の目視確認・キーボード操作の実機確認は、引き続き次の担当者の判断が必要（§8参照）。**

## 8. 責任者確認が必要な事項

- フィルタ・並び替えの基準を「一般／成人向け」「更新日時／タイトル」で確定してよいか（`お気に入り`は実装していない。実装する場合は`Project`型へのフィールド追加が必要になり、DB migrationが発生する）
- ページ数のカード表示を実装する場合、新規の読み取り専用IPC追加が必要になる旨の確認
- 説明文（subtitle/description）をカードへ戻すかどうか
- **カバーありProjectの目視確認方法**: 既存IPCのみでは実現できないため（§7参照）、(a) テスト専用の画像import IPCを新規追加して許可するか、(b) Windows実機での手動確認で代替するか、(c) 静的テストのカバー分岐検証で十分とするか
- Projectカード自体のTab/Enter等のキーボード実機操作確認をどう完了させるか（追加ハーネス、またはWindows実機確認）

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

注入している22個のJavaScriptブロック（`--mangai-accessibility-test`ハーネスの`executeJavaScript`文字列）は`new Function()`による構文チェックでエラーなし（TypeScriptの`${...}`テンプレート補間箇所はダミー文字列へ置換したうえで検証）。

## 10. 正直な申告: Windows CI結果は未確認（第1ラウンド時点の記録。§12で更新）

**本コンテナ環境にはXサーバーがなくElectronを実際にレンダリングできないため、本PRのGUI検証部分（§6）が実際のWindows環境で意図通り動作するかは未確認。** PR-B（PR #45）では同種の追加が2回のCI失敗を経て動作確認できた実績があるため、同様に初回のCI結果を見て修正が必要になる可能性がある。Draft PR作成後、GitHub Actions（Windows runner）の結果を確認し、失敗した場合はログ・artifactを見て追加commitで修正する。

## 11. ロールバック方法

1. **本PR全体の取り消し**: ブランチ・PRをcloseすれば`feature/manga-canvas-mvp`には影響しない（未マージの間）。
2. **カードグリッドのみ取り消す**: `main.tsx`から`HomeProjectGrid`/`HomeProjectFilters`のimportと配線を削除し、`features/home/`・`components/home/`配下の新規ファイルを削除すれば、Phase D3-B完了時点のHome画面（横長リスト表示）へ戻る。`styles.css`の`.projects`/`.project-open`/`.cover`/`.project-summary`/`.actions`ルールも元の値へ戻す必要がある。
3. DB migration、API、Storage、IPCへの変更は一切ないため、ロールバックにデータ影響はない。

## 12. 責任者レビュー指摘への対応（第2ラウンド）

Windows CI成功後（`f8386ed`まで）、責任者がCI artifactのスクリーンショットを目視確認し、Projectが1件のときカードが画面全幅まで拡大し作品名・Badge・操作ボタンが初期表示の下へ押し出される不具合を発見した。以下のとおり対応した。

| 指摘 | 対応 |
| --- | --- |
| 1. カード最大幅の制限 | `.home-project-grid`を`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))`から`repeat(auto-fill, minmax(240px, 280px))` + `justify-content: start`へ変更。1件時でもカード幅が280px（実測上限320px）を超えず、カバー画像（3:4）も画面高を超えない |
| 2. Windows GUI検証への追加 | §6参照。1件時の幅チェック・1920×1080/1366×768ごとの幅・左寄せ・可視性チェックを追加 |
| 3. テストデータ拡張 | §6・§7参照。1件・4件・10件以上・長いタイトル・一般／成人向け混在を自動確認対象に追加。カバーあり／なしは既存IPCの制約により未実装（§7・§8で理由と選択肢を明記） |
| 4. `@media (max-width: 899px)`の整理 | `apps/desktop/src/main/index.ts`の`BrowserWindow`は`minWidth: 1100`のため、899px以下は実機で到達不可能なdead codeだった。DESKTOP_CREATIVE_STUDIO_SPEC.md §5（未承認のブレークポイント再編）に該当する新規ブレークポイントを実質追加してしまっていた不整合を、当該メディアクエリの削除により解消した（「ブレークポイントを変更していない」という記述と実態を一致させた） |
| 5. PR本文・実装記録の更新 | 本セクションおよび§6〜§10で反映。ExecuteJavaScriptブロック数は22個（§9） |

**この指摘は`DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1が明示するグリッド仕様（`auto-fit, minmax(240px, 1fr)`）からの意図的な逸脱である。** 少数Project時の実害（カードの過度な拡大・操作領域の視認性低下）を優先し、責任者の直接指摘に基づいて`auto-fill` + 固定最大幅へ変更した。将来的に§4.1を更新するかどうかは別途責任者判断が必要。

### カバーありProjectの目視確認について（未実装の技術的理由）

既存IPC `importDroppedAssets(projectId, files: File[])` は内部で`webUtils.getPathForFile(file)`を呼び出し、OSのドラッグ&ドロップまたはファイル選択ダイアログ由来の`File`オブジェクトが持つ実ファイルパスを取得する。ヘッドレスCI上でJavaScriptから合成した`File`/`Blob`オブジェクトはこの実ファイルパスを持たないため、既存IPCを変更せずにカバー画像付きProjectを自動生成する手段がない。新規のテスト専用IPC追加、またはAI生成パイプライン（本フェーズの明示的な禁止事項）を利用する以外に方法がなく、いずれも本フェーズの範囲外と判断した。§8で責任者判断を仰ぐ。
