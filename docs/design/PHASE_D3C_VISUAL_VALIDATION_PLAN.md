# Phase D3-C準備: Desktop目視確認基盤（PR-B）

作成日: 2026-07-27（2026-07-27 CI確認結果を反映し更新）
状態: **確立完了**。Windows CI（`windows-latest`、GitHub Actions）上で、コマンドパレット目視確認12項目（11チェック）すべてがPASSしたことを確認済み（run: https://github.com/team478a/manga/actions/runs/30257023926 、job: `Windows build`、head SHA `ce4c8a8`）。
Base branch: `feature/manga-canvas-mvp` @ `16f87769ce3a226942ff2e9cf082f67204f9cc2e`（PR #43マージ済みコミット）
作業ブランチ: `test/phase-d3c-visual-validation`

正本: 「MANGAI 次期実装指示書（Phase D3-C準備・Home画面刷新・依存関係安全確認）」（2026-07-27）§3 PR-B

## 1. 調査結果

指示書§3「最初に調査すること」の7項目について調査した結果を記録する。

| 項目 | 調査結果 |
| --- | --- |
| 1. 現在のElectron起動方法 | `apps/desktop/scripts/test-accessibility.mjs`が`electron`パッケージ（`require("electron")`で取得する実行ファイルパス）を`spawnSync`で起動し、`--mangai-accessibility-test --disable-gpu`フラグを渡す。メインプロセス（`apps/desktop/src/main/index.ts`）はこのフラグを見て自動化用の分岐へ入る |
| 2. 既存のアクセシビリティテスト実行方法 | `npm run test:a11y`（`apps/desktop/package.json`）→ `npm run build && node scripts/test-accessibility.mjs`。メインプロセスが`BrowserWindow`を作成し、`webContents.executeJavaScript()`でレンダラーDOMを直接操作・`axe-core`を注入して監査し、結果をJSONへ書き出す |
| 3. GitHub Actions Windows runner上でElectron画面を起動できるか | できる。`.github/workflows/desktop-windows.yml`の`windows-build`ジョブが`windows-latest`上で`npm run test:a11y`を既存の必須ステップとして実行しており、これまでのPR（#42、#43含む）で継続してsuccessしている。すなわちWindows CI runner上でのElectron起動・レンダリングは既に実績がある |
| 4. 既存依存関係だけでスクリーンショット取得が可能か | 可能。Electron本体が提供する`webContents.capturePage()`（`NativeImage`を返し`.toPNG()`でPNGバッファ化できる）を使えば、新規パッケージなしでスクリーンショットを取得できる |
| 5. Playwright、Spectron、WebdriverIO等が既に導入済みか | 未導入。`apps/desktop/package.json`のdependencies/devDependenciesに該当パッケージは存在しない（`axe-core`のみ、これはブラウザ自動操作ライブラリではなくaxeの監査エンジン） |
| 6. テスト用Projectデータを安全に固定投入できるか | 可能。既存のアクセシビリティテストが`store.createProject`等をメインプロセスから直接呼び出し、"Accessibility Test Project"というテスト用Projectと生成ジョブ状態（running/completed/failed、Dezgoの完了状態）を固定投入している（実Provider・実APIは一切呼ばない） |
| 7. 成人向けProjectや外部Providerを起動せずHome画面だけ確認できるか | 可能。既存のテストデータ投入はcontentClass="general"のProjectのみを使い、Dezgo等の呼び出しは`store`への直接書き込みでモックしている（実際のネットワーク呼び出しはない）。Home画面の確認は、Project作成前の初期状態でも、既存Project一覧表示状態でも行える |

## 2. 採用方針

指示書§3の優先順位に従い、**第1候補（スクリーンショットartifact）と第2候補（既存アクセシビリティテストの拡張）を組み合わせて実装した**。新規依存パッケージは追加していない。

理由:

- 第1候補・第2候補はいずれも既存の`--mangai-accessibility-test`ハーネス（`apps/desktop/src/main/index.ts`）を土台にでき、Electron組み込みの`webContents.capturePage()`と`webContents.executeJavaScript()`だけで両方を満たせる。
- 第3候補（Windows実機手動確認）は、実機・実ディスプレイが必要で本コンテナ環境では実施できない。第1・第2候補が機能すれば、実機なしで再現可能な自動確認が得られるため、第3候補は不要と判断した。

## 3. 実装内容

### 3.1 コマンドパレット目視確認ブロックの追加

`apps/desktop/src/main/index.ts`の`accessibilityTest`分岐に、既存のaxe監査（無変更）とは別のブロックとして、コマンドパレット専用の検証ブロックを追加した。既存のaxe監査フローが完了し、Project作成等のテストデータ投入（`generationStateSeed`）が成功したことを確認した直後に実行される。

検証項目は指示書§3「コマンドパレットの必須確認項目」12項目に対応する。

| # | 指示書の確認項目 | 実装した検証 |
| --- | --- | --- |
| 1 | Home画面のボタンから開く | `open-via-button`: トリガーボタン（`aria-label="コマンドパレットを開く (Ctrl+K)"`）をクリックし、`.ds-command-palette[role="dialog"]`が出現することを確認 |
| 2 | `Ctrl+K`から開く | `open-via-ctrl-k`: `document`へ`KeyboardEvent('keydown', {key:'k', ctrlKey:true})`を発火し、ダイアログが出現することを確認 |
| 3 | 再度ボタンを押すと閉じる | `toggle-close-via-button`: トリガーボタンを再クリックし、ダイアログが消えることを確認 |
| 4 | Escapeで閉じる | `close-via-escape`: 検索入力へ`Escape`のkeydownを発火し、ダイアログが消えることを確認 |
| 5 | 検索入力へフォーカスされる | `open-via-button`の一部として、開いた直後に`document.activeElement`が検索入力と一致することを確認 |
| 6 | 上下キーで選択移動できる | `arrow-key-navigation`: `ArrowDown`発火の前後で、選択中の行（`.ds-command-palette-row-active`）のidが変化することを確認 |
| 7 | Enterでコマンドを実行できる | `enter-executes-and-restores-focus`: 開いた直後（先頭候補=常に`nav-home`）で`Enter`を発火し、ダイアログが閉じることを確認 |
| 8 | Projectを開ける | `open-project-from-recent`: 「最近開いたProject」セクションから、テストで作成した"Accessibility Test Project"の行を検索・クリックし、`.manga-canvas-shell`が出現する（Project本文が開く）ことを確認 |
| 9 | 設定画面へ移動できる | `navigate-to-settings`: Project内から`Ctrl+K`で開き、id末尾が`-option-nav-settings`の項目をクリックし、`[data-workspace-view="settings"][aria-current="page"]`が出現することを確認 |
| 10 | 閉じた後に起動元へフォーカスが戻る | `enter-executes-and-restores-focus`の一部として、実行後の`document.activeElement`がトリガーボタンと一致することを確認 |
| 11 | 既存モーダルやフォームを壊していない | `disabled-while-modal-open`: 新規Projectダイアログを開いた状態で`Ctrl+K`を発火し、コマンドパレットが**開かない**こと（`commandPaletteDisabled`が機能していること）を確認し、既存フォームの操作性を損なっていないことを間接的に検証 |
| 12 | AI Provider有効化、成人向け生成、課金操作を直接実行できない | `no-forbidden-commands-rendered`: 開いた状態で、描画されている全コマンドラベルに対し禁止パターン（Provider有効化・成人向け生成・APIキー・Stripe/checkout・課金・削除・一括削除）の正規表現マッチが0件であることを確認 |

各検証は`checkStep()`ヘルパーで個別にtry/catchされ、1件失敗しても後続の検証は継続する（失敗を握りつぶさず、全項目の結果を`command-palette-visual.json`へ記録するため）。

### 3.2 スクリーンショットの保存

`win.webContents.capturePage()`（Electron組み込み、追加パッケージ不要）で、以下のタイミングのPNGを`screenshots/`ディレクトリへ保存する。

- `home-before-command-palette.png`
- `command-palette-open-button.png`
- `command-palette-closed-toggle.png`
- `command-palette-open-ctrlk.png`
- `command-palette-closed-escape.png`
- `command-palette-arrow-selection.png`
- `command-palette-after-select.png`
- `command-palette-project-opened.png`
- `command-palette-settings-open.png`

命名規則: `{状態}-{操作}.png`のケバブケース。OS・解像度・DPIはWindows CI runner既定値（`windows-latest`、既存の`test:a11y`と同一環境）に固定されるため、ファイル名へは含めていない。commit SHAとタイムスタンプは同じディレクトリの`command-palette-visual.json`の`checkedAt`フィールドと、CIのjob run URLから追跡できる。

### 3.3 レポートの保存先とCI連携

- `command-palette-visual.json`: `checkedAt`と`checks`（各項目のid・label・pass・detail）を含む。既存のaxeレポート（`accessibility-home.json`）と同じディレクトリへ保存される。
- `.github/workflows/desktop-windows.yml`の`Accessibility tests`ステップへ`MANGAI_A11Y_REPORT`環境変数を追加し、レポート出力先を一時ディレクトリ（実行後に削除される）から`apps/desktop/artifacts/test-results/accessibility-home.json`へ変更した。これにより、`screenshots/`ディレクトリも同じ`artifacts/test-results/`配下に生成され、既存の`Upload Windows test results`ステップ（`path: apps/desktop/artifacts/test-results`）がそのままスクリーンショットとレポートをartifactとしてアップロードする。**新規のアップロードステップは追加していない**
- `scripts/test-accessibility.mjs`を拡張し、`command-palette-visual.json`が存在する場合はその内容とスクリーンショットのファイル一覧を標準出力へ出力するようにした。これは`Accessibility tests`ステップの`Tee-Object -FilePath artifacts/test-results/accessibility-test.log`によりログファイルへも記録される

### 3.4 失敗時の挙動

- いずれかの検証項目が`pass: false`の場合、標準エラー出力へ失敗項目の一覧（id・detail）を出力したうえで、`test:a11y`全体を失敗させる（`throw new Error(...)`）。これは既存のaxe監査（serious/critical違反時に失敗させる）と同じ扱いであり、CI上の「Accessibility tests」ステップが失敗し、`Windows build`チェック全体が失敗する
- 失敗時も`command-palette-visual.json`とその時点までのスクリーンショットは書き出し済みのため、CI失敗時のartifactから原因を特定できる

## 4. 再実行手順

Windows環境（実機またはCI）で以下を実行する。

```powershell
cd apps/desktop
npm ci
npm run test:a11y
```

`MANGAI_A11Y_REPORT`環境変数を設定すると、レポートとスクリーンショットの保存先を指定できる（省略時は一時ディレクトリに保存され、終了時に削除される）。

```powershell
$env:MANGAI_A11Y_REPORT = "C:\path\to\accessibility-home.json"
npm run test:a11y
```

失敗した場合は、`command-palette-visual.json`の`checks`配列から`pass: false`の項目とその`detail`を確認し、対応する`screenshots/`内のPNGと突き合わせて原因を切り分ける。

## 5. CI実行結果（確定）

本コンテナ環境にはXサーバーがなくローカルでElectronを起動できないため、実装直後は静的検証（型検査・lint・ビルド・注入JavaScriptの構文チェック）のみで、実際のGUI動作は未検証のままDraft PRを作成した。Windows CI（GitHub Actions、`windows-latest`）の実行結果を確認し、以下の2件の不具合を発見・修正した。

1. **1回目の失敗**（head SHA `909b9f1`）: `enter-executes-and-restores-focus`が`activeId=project-new`（期待値`nav-home`）で失敗。原因はテストコード自体の状態管理ミス — 直前の`arrow-key-navigation`検証がパレットを開いたまま次のステップへ進んでいたため、次のCtrl+K（トグルではなく常時「開く」という実装どおりの仕様）が無反応になり、選択中インデックスが「project-new」のまま残ってEnterを誤実行していた。`arrow-key-navigation`の最後にEscapeで明示的に閉じるよう修正（commit `cf4699b`）
2. **2回目の失敗**（head SHA `2146f43`）: `activeId`は`nav-home`に修正されたが、`focusReturned=false`のまま失敗。原因は、フォーカス復帰の判定が直前のステップで残っていた暗黙のフォーカス状態に依存しており、前提条件が自己完結していなかったこと。トリガーボタンへ明示的に`.focus()`してから開くよう修正し、`previouslyFocused`が確実にトリガーボタンを捕捉するようにした（commit `ce4c8a8`）
3. **3回目の実行**（head SHA `ce4c8a8`）: **全11チェックPASS**。`Windows build`ジョブ成功（https://github.com/team478a/manga/actions/runs/30257023926 ）。`command-palette-visual.json`の全項目が`pass: true`、`enter-executes-and-restores-focus`は`activeId=nav-home closed=true focusReturned=true`で確認済み。スクリーンショット9枚、電子署名済み`pack:win`ビルドも成功

いずれの不具合も、コマンドパレット本体（`CommandPalette.tsx`）・アプリ側のロジックの不具合ではなく、**目視確認ハーネス（テストコード）自体**に起因するものであり、修正はテストコードのみに閉じている。

## 6. 目視確認手段の確立: 判定

- 自動UI確認テスト: 実装済み・**Windows CIで成功確認済み**（本ファイル§3.1〜3.3、§5）
- Windows CIジョブへの安全な追加: 実装済み（既存`Accessibility tests`ステップの拡張、新規ジョブ・新規ステップ追加なし）
- screenshot artifact: 実装済み・**確認済み**（`desktop-windows-results`artifactに9枚のPNGを含めて正常アップロード）
- 失敗時のログ: 実装済み・**実際に2回の失敗で機能を確認済み**（`command-palette-visual.json` + `accessibility-test.log`から原因を特定できた）
- 再実行手順: 本ファイル§4に記載

**目視確認手段の確立は完了した。** `READY_FOR_REVIEW`として扱う。

## 7. Phase D3-Cへの示唆

Windows CIでの実行が成功した場合、Phase D3-C（Home画面ビジュアル刷新）では、本ブランチで整備したスクリーンショット基盤を流用し、指示書§3-C「目視確認」表の各条件（解像度・DPI・データ件数パターン等）ごとにスクリーンショットを追加投入することで、目視確認要件を満たせる見込みである。
