# Phase D3-B: コマンドパレットのDesktop画面接続

作成日: 2026-07-26
状態: 実装完了（コード変更あり）。目視確認は未実施（環境制約）。
Base branch: `feature/manga-canvas-mvp`
Base SHA: `242334b562ae2cb89c518cace8208db230d6a261`（PR #41マージ済みコミット）
作業ブランチ: `design/phase-d3b-command-palette-integration`

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§3.4、[`PHASE_D3_COMMAND_PALETTE.md`](PHASE_D3_COMMAND_PALETTE.md)（単体実装の記録）

## 1. 目的

PR #39で単体実装した`CommandPalette`コンポーネント（`apps/desktop/src/renderer/components/common/CommandPalette.tsx`、無変更）を、MANGAI Desktopの実画面へ接続し、「単体コンポーネント」から「実際に利用できる機能」へ進めた。

## 2. 実装範囲

### 2.1 起動方法

- `Ctrl+K`（Windows/Linux）・`Meta+K`（macOS互換）のグローバルキーボードショートカット
- Home画面ヘッダーの「コマンド Ctrl K」トリガーボタン（`Button variant="secondary"`）
- 制作ワークスペース（`AppHeader`）の「⌘K」トリガーボタン（`Button variant="secondary" size="sm"`）

起動判定は`apps/desktop/src/renderer/features/command-palette/use-command-palette.ts`が公開する純粋関数`shouldOpenCommandPalette(event, { disabled })`に集約した。以下の場合は起動しない。

- IME変換中（`event.isComposing`）
- Alt併用、Shift併用、Ctrl+Meta同時押しなど想定外の修飾キー組み合わせ
- 新規Project作成モーダル（`creating`）またはExportダイアログ（`exportDialogOpen`）が開いている間（`disabled`フラグ）

`useCommandPalette`のショートカット登録は単一の`useEffect`（依存配列`[disabled]`）にまとめており、`document.addEventListener("keydown", ...)`は1箇所のみ、対応する`removeEventListener`をクリーンアップ関数として返している。`disabled`が変化した場合もReactが再実行前に必ずクリーンアップを呼ぶため、リスナーが重複登録されることはない。Component unmount時も同じクリーンアップにより確実に解除される（`design-command-palette-integration.test.mjs`のソース検査テストで確認）。

「アプリが閉じる途中」を検知する既存のフックや信号は本コードベースに存在しないため、個別の対応は行っていない（Electronのウィンドウ破棄後はイベントリスナー自体が発火しなくなるため、実害はないと判断）。

### 2.2 終了方法

`CommandPalette.tsx`本体（Phase D3で実装済み、本フェーズでは無変更）の既存契約をそのまま利用した。

- Escapeで閉じる
- オーバーレイ（スクリム）クリックで閉じる
- コマンド実行後に自動で閉じる
- 起動ボタン（Home / AppHeader）を開いている状態で再操作すると閉じる（`togglePalette`、`aria-pressed`で開閉状態を反映）
- 閉じた後、開いた時点でフォーカスしていた要素（トリガーボタン、またはCtrl+K押下時にフォーカスしていた要素）へ復帰する

### 2.3 上部バーのトリガー

Home画面と制作ワークスペース（`AppHeader`）の2箇所に設置した。いずれも既存の`Button`共通コンポーネント（Phase D2実装）を使用し、`aria-label`を付与し、キーボード操作可能（ネイティブ`<button>`と同等）。

**設置していない画面**: 設定／チャット／AI画像生成／Hub接続状態の各画面（`ToolShell`でラップされた画面）には、専用の上部バーが存在しないため、トリガーボタンは設置していない。これらの画面でも`Ctrl+K`/`Meta+K`のグローバルショートカットは有効（`<CommandPalette>`要素を各画面のreturn文へ追加済み）。

### 2.4 コマンドの分類

`apps/desktop/src/renderer/features/command-palette/command-palette-items.ts`の`buildCommandSections()`が、現在の画面文脈（`hasActiveProject: boolean`）に応じて以下を組み立てる。存在しない・到達不能な画面へのコマンドは生成しない。

| セクション | コマンド | 条件 |
| --- | --- | --- |
| 移動 | Homeを開く | 常時 |
| 移動 | 制作ワークスペースを開く / AI画像生成を開く / 設定を開く | Projectが開いている時のみ |
| Project | 新規Project作成画面を開く | 常時（既存の`setCreating(true)`） |
| Project | 選択中Projectのバックアップ | Projectが開いている時のみ（既存の`backupProject()`） |
| Project | Project復元画面を開く | 常時（既存の`restoreProject()`） |
| 一般操作 | 設定を開く / Hub接続状態を開く | Projectが開いている時のみ |
| 一般操作 | 更新を確認する | 常時（`window.mangai.updater.check()`を直接呼び出し） |
| 最近開いたProject | Project名 + 更新日時 | 最大5件、`updatedAt`降順。0件の場合はセクション自体を出力しない |

**「診断画面を開く」は実装していない**: このコードベースにレンダラー側の診断画面（ナビゲーション可能なUI）が存在しないため、指示書にあった候補から除外した。存在しない画面へのリンクを作らないという制約を優先した。

**削除・成人向け移動などの危険操作は追加していない**（指示書どおり）。

**無効なProjectレコードの除外**: `id`または`title`を欠くProjectレコードは`recent-project-commands.ts`の`isValidProject`で最近開いたProjectから除外し、存在しない・不正なコマンドを生成しない。

### 2.5 検索

`CommandPalette.tsx`の既存の検索実装（`label`の部分一致フィルタ、大文字小文字区別なし）をそのまま利用した。新しい検索ライブラリや曖昧検索ロジックは追加していない。

## 3. 安全境界（実装確認）

以下はいずれも実装していない。`apps/desktop/tests/design-command-palette-integration.test.mjs`で、生成される全コマンドラベルおよび`command-palette-items.ts`の実コード（コメント除く）に該当パターンが存在しないことを機械的に確認している。

- AI Providerの直接有効化・切替
- ComfyUI、Dezgo、外部Providerの直接切替
- 成人向け生成の直接実行
- 外部送信確認・費用見積り・利用者承認の省略
- APIキー変更、課金設定変更、Stripe Checkoutの直接開始
- Project削除、データ一括削除
- DB schema、Storage path、Desktop IPC、バックアップ形式、migrationの変更

Provider関連の操作が必要な場合、コマンドパレットからは「設定を開く」（`goSettings` → 既存の`setActiveTool("settings")`）のみに限定されており、その先の実際のProvider有効化・切替操作は既存の設定画面（`AISettings`等）の確認フローをそのまま経由する。コマンドパレットが確認フローを迂回する経路にはなっていない。

## 4. 実装構造

```
apps/desktop/src/renderer/features/command-palette/
├── command-palette-items.ts     セクション組み立て（移動/Project/一般操作/最近開いたProject）
├── recent-project-commands.ts   最近開いたProjectの抽出・妥当性検証・セクション化（純粋関数）
└── use-command-palette.ts       ショートカット起動判定（純粋関数）＋開閉・トグル状態フック
```

「最近開いたProjectの変換処理」（Projectレコードの妥当性検証、更新日時での並べ替え、上限件数の適用、コマンドセクションへの変換）は`recent-project-commands.ts`へ分離し、`command-palette-items.ts`はそれを呼び出すだけの薄い組み立て役に限定した。`command-palette-items.ts`は後方互換のため`getRecentProjects`を`recent-project-commands.ts`から再エクスポートしている。「ショートカット登録」「コマンド項目の生成」「Projectデータから最近使用項目を作る処理」「画面側の表示状態」の4つの責務は、この3ファイル＋`main.tsx`側の薄い配線コードに明確に分離されている。

`CommandPalette.tsx`自体は、Project・AI Provider・DB・IPCの知識を一切持たない（Phase D3時点のまま無変更）。`command-palette-items.ts`もIPC呼び出しを直接実装せず、`main.tsx`が用意した`actions`コールバック経由でのみ既存関数（`apply`、`backupProject`、`restoreProject`、`window.mangai.updater.check`等）を呼び出す。

## 5. アクセシビリティ

`CommandPalette.tsx`（Phase D3実装、無変更）の既存契約により、以下は満たされている。

- `role="dialog"` `aria-modal="true"`、結果は`role="listbox"`/`role="option"`
- 開いた瞬間に検索入力へフォーカス、Escまたは実行後に閉じて呼び出し元へ復帰
- 上下キーで選択、Enterで実行
- 結果件数を`aria-live="polite"`で通知（視覚的には`.ds-visually-hidden`）
- `forced-colors`時は不透明背景へフォールバック、`prefers-reduced-motion`は既存のグローバルルールに従う（本コンポーネントに開閉アニメーションはない）

新規追加したトリガーボタン（Home / AppHeader）は`Button`共通コンポーネントを使用しており、既存の`--focus-ring`とキーボード操作性を継承している。

IME入力については、ショートカット判定側（`shouldOpenCommandPalette`）で`event.isComposing`を確認し、変換中の起動を防いでいる。パレット内の検索入力自体はIMEを妨げない標準の`<input type="text">`のままで、変換確定Enterと実行Enterを区別する特別な処理は追加していない（既存のブラウザ標準動作に委ねている）。

## 6. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `apps/desktop/src/renderer/features/command-palette/command-palette-items.ts`（新規） | セクション組み立て。最近開いたProjectの実処理は`recent-project-commands.ts`へ委譲 |
| `apps/desktop/src/renderer/features/command-palette/recent-project-commands.ts`（新規） | 最近開いたProjectの抽出・妥当性検証（`isValidProject`）・セクション化 |
| `apps/desktop/src/renderer/features/command-palette/use-command-palette.ts`（新規） | ショートカット判定（純粋関数）＋開閉・トグル状態フック |
| `apps/desktop/src/renderer/main.tsx` | `CommandPalette`のimportと配線（6箇所のreturn文へ追加）、Home画面トリガーボタン追加（`toggleCommandPalette`・`aria-pressed`）、`openWorkspaceView`/`openProjects`の宣言位置を前方へ移動（配線コードから参照するため、ロジック自体は無変更） |
| `apps/desktop/src/renderer/components/app-shell/AppHeader.tsx` | `onOpenCommandPalette` propを`onToggleCommandPalette`へ改名し`commandPaletteOpen: boolean`を追加、トリガーボタンに`aria-pressed`を付与（既存の他props・既存ボタンは無変更） |
| `apps/desktop/src/renderer/styles.css` | `.ds-button kbd`のスタイルを追加（既存ルールは無変更） |
| `apps/desktop/tests/design-command-palette-integration.test.mjs`（新規） | 26件のテスト（詳細は§7） |
| `apps/desktop/tests/design-command-palette.test.mjs` | 「どの画面からもimportされていない」テストを、Phase D3-Bの実態（main.tsxのみが配線）に合わせて更新 |
| `apps/desktop/package.json` | `test`スクリプトへ新規テストファイルを追加 |
| `docs/design/PHASE_D3B_COMMAND_PALETTE_INTEGRATION.md`（本ファイル、新規） | 本記録 |
| `docs/design/PHASE_D3_COMMAND_PALETTE.md` | Phase D3-Bで配線が完了したことを追記 |
| `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md` | 更新 |

## 7. テスト結果

`design/phase-d3b-command-palette-integration`ブランチで実行。

| コマンド | 結果 |
| --- | --- |
| `npm install` | 完了（`npm audit`: high 11件、既存分・本タスクでは対応せず） |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**157/157**。既存131件 + 新規`design-command-palette-integration.test.mjs` 26件、既存`design-command-palette.test.mjs`は更新のうえ回帰なし） |
| `npm run desktop:test:a11y`（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT（本コンテナにXサーバーがなくElectron起動不可。`electron_main_delegate.cc:216 Running as root without --no-sandbox is not supported`） |
| `npm run desktop:build` | PASS |
| `git diff --check` | PASS |

新規テスト26件の内訳（STEP10の14項目 + 追加要件に対応）:

1. Ctrl+Kのショートカット登録（`shouldOpenCommandPalette`直接呼び出し）
2. Meta+Kのショートカット登録
3. IME変換中は起動しない
4. disabled中（モーダル操作中）は起動しない
5. 想定外の修飾キー組み合わせ（Alt併用・Shift併用・Ctrl+Meta同時）では起動しない
6. K以外のキーでは起動しない
7. Escapeで閉じる実装の維持（CommandPalette.tsx）
8. Home画面の上部バートリガーの存在、および再操作でトグルする（`toggleCommandPalette`）配線の確認
9. AppHeaderの上部バートリガーの配線（`onToggleCommandPalette`）
10. `useCommandPalette`: `togglePalette`が開閉状態を反転させる契約を持つ
11. 移動セクション: Home移動コマンドの存在
12. 移動セクション: 設定移動コマンドはProjectが開いている時だけ存在する
13. 最近開いたProjectは最大5件・更新日時降順
14. 最近開いたProjectセクションは存在しないProject IDを生成しない
15. id・titleを欠く無効なProjectレコードは最近開いたProjectから除外される（`isValidProject`）
16. Projectが0件の場合、最近開いたProjectセクションはコマンド一覧に含まれない
17. Projectセクション: 新規Project作成コマンドが常に存在する
18. Projectセクション: 削除・成人向け移動・一括削除・初期化コマンドが存在しない
19. `useCommandPalette`: keydownリスナーをuseEffectのcleanupで確実に解除する
20. `useCommandPalette`: disabled変更時に古いリスナーを解除してから再登録する（多重登録防止）
21. 安全境界: Provider直接有効化・成人向け生成直接実行・APIキー変更コマンドが存在しない（`command-palette-items.ts`・`recent-project-commands.ts`の実コード、コメント除く）
22. 安全境界: 生成されるコマンドラベルに危険操作を示す語が含まれない
23. コマンド実行後にonCloseが呼ばれる契約の維持
24. フォーカス復帰契約の維持
25. 新規npm依存パッケージが追加されていない（ルート）
26. 新規npm依存パッケージが追加されていない（apps/desktop、依存キーの完全一致検査）

## 8. CI結果

CI実行後に追記する（Draft PR作成・push後、GitHub Actions完了を待って更新）。

## 9. 目視確認

**未実施。** 本コンテナ環境にはXサーバー（ディスプレイ）がなく、Electronアプリを実際にレンダリングして目視確認できないため、指示書STEP12の以下の項目はいずれも確認していない。

- Home画面から上部バーボタンで開く
- 開いている状態で上部バーボタンを再操作すると閉じる（トグル）
- Ctrl+Kで開く
- 検索入力が自動フォーカスされる
- 上下キーとEnterで操作できる
- Escapeで閉じる
- Projectを開ける
- 設定画面へ移動できる
- コマンド実行後にパレットが閉じる
- 閉じた後に起動元へフォーカスが戻る
- 既存モーダルやフォーム操作が壊れていない
- 成人向けまたは外部Providerの安全確認を迂回できない

上記はいずれも、静的検証（型検査・lint・§7の自動テスト）で可能な範囲を確認したのみである。実機またはGUI付き環境での目視確認は、次の対応可能な担当者またはWindows実機・GitHub Actions（GUIランナー）での確認が必要。

## 10. 外部環境待ち

- Windows実機またはGUI付き環境でのElectron起動・目視確認
- GitHub Actions Desktop Windows workflowでの`npm run test:a11y`成功確認（push・PR作成後に確認）

## 11. 次の推奨作業

- 目視確認が可能な環境が整い次第、§9の11項目を確認する
- Phase D3-C（Home画面のビジュアル刷新: Projectカードのグリッド化等）は、同じ目視確認手段が整うまで着手しない
- ToolShell配下の画面（設定/チャット/AI画像生成/Hub接続状態）に、それぞれの持つヘッダーへ個別のコマンドパレットトリガーボタンを追加するかどうかは、責任者の判断を仰ぐ（Ctrl+Kは既に全画面で機能する）

## 12. ロールバック方法

1. **本PR全体の取り消し**: ブランチ・PRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（未マージの間）。
2. **配線のみを取り消す**: `main.tsx`から`CommandPalette`のimportと6箇所の配線、Home/AppHeaderのトリガーボタンを削除し、`AppHeader.tsx`の`onOpenCommandPalette` propを削除すれば、Phase D3（単体実装のみ）の状態へ戻る。`CommandPalette.tsx`自体、`features/command-palette/`配下の新規ファイルは他画面から参照されなくなるだけで、削除しても影響はない。
3. DB migration、API、Storage、IPCへの変更は一切ないため、ロールバックにデータ影響はない。
