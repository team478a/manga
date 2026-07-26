# Phase D3: Home画面へのButtonコンポーネント適用

作成日: 2026-07-26
状態: 実装完了（コード変更あり）。Home画面の全面ビジュアル刷新（Cardグリッド化等）は未着手。
ブランチ: `design/phase-d3-home-screen`（base: `feature/manga-canvas-mvp` @ `2b4f97d`、PR #35〜#38マージ後）

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§3.1、§4.1

## 1. スコープと判断理由

責任者より「Phase D3（既存画面への適用）」に着手する指示を受けたが、本ブランチでは**スコープを意図的に絞り込んだ**。理由は以下の通り。

- `DESKTOP_CREATIVE_STUDIO_SPEC.md`§4.1が定義するHome画面の全面刷新（Projectカードのauto-fitグリッド化、3:4カバー画像、hover時ケバブメニュー、フィルタchip、下部ステータス帯の新設、コマンドパレットトリガーの上部バー設置）は、既存の`.projects`/`.project-open`/`.cover`/`.project-summary`等のCSS・レイアウトを丸ごと置き換える大規模な変更であり、
- 本コンテナ環境にはXサーバーがなくElectronアプリを実際にレンダリングして目視確認できない（`docs/design/PHASE_D1_IMPLEMENTATION.md`§6・`PHASE_D2_IMPLEMENTATION.md`§7と同一の制約）。
- CLAUDE.mdの指示「UIやフロントエンドの変更は、実際にブラウザ等で動作確認してから完了とすること。確認できない場合はその旨を明示すること」に従い、**目視確認ができない状態で大規模なレイアウト変更を行うことは避けた**。

そのため本ブランチでは、**Phase D2で実装したButtonコンポーネントを、Home画面の既存レイアウトを一切変更せずに適用する**という、機能的に安全で静的検証（型検査・lint・機械的なソース検査）だけで確度高く正しさを確認できる範囲に限定した。Home画面のカードグリッド化・下部ステータス帯・フィルタchip・コマンドパレットトリガーの実設置は、目視確認が可能な環境が整うか、責任者の追加判断を経てから別フェーズで対応する。

## 2. 変更内容

`apps/desktop/src/renderer/main.tsx`の以下のネイティブ`<button>`要素を、Phase D2の`Button`コンポーネントへ置き換えた。**テキスト・aria-label・ref・onClick等のロジックはすべて元のまま**で、要素をButtonへ置き換えたのみ。

| 箇所 | 置き換え前 | 置き換え後 |
| --- | --- | --- |
| ヘッダー「自動バックアップ」 | `<button className="secondary">` | `<Button variant="secondary">` |
| ヘッダー「復元」 | `<button className="secondary">` | `<Button variant="secondary">` |
| ヘッダー「新規Project」 | `<button ref={newProjectButtonRef}>` | `<Button variant="primary" ref={newProjectButtonRef}>` |
| エラー閉じるボタン（×） | `<button className="secondary">` | `<Button variant="secondary" size="sm">` |
| 新規Projectモーダル: フォルダ選択/リセット | `<button type="button" className="secondary">` | `<Button type="button" variant="secondary">` |
| 新規Projectモーダル: キャンセル | `<button type="button" className="secondary">` | `<Button type="button" variant="secondary">` |
| 新規Projectモーダル: 作成 | `<button>`（フォーム内、暗黙のtype="submit"） | `<Button type="submit" variant="primary">`（**type="submit"を明示** — Button既定値は"button"のため、明示しないとフォーム送信が壊れる） |
| Project行: 成人向けへ移動 | `<button>` | `<Button variant="secondary" size="sm">` |
| Project行: バックアップ | `<button>` | `<Button variant="secondary" size="sm">` |
| Project行: 複製 | `<button>` | `<Button variant="secondary" size="sm">` |
| Project行: 削除 | `<button className="danger">` | `<Button variant="danger" size="sm">` |

### 意図的に変更していないボタン

- Projectカードのトリガー本体（`className="project-open"`、カバー画像+作品名+メタ情報を内包する複合ボタン）は、Buttonコンポーネントのvariant体系に馴染まない独自レイアウトのため変更していない。カードグリッド化と合わせて別フェーズで扱う。

## 3. 見た目への影響（既知の差分）

- `secondary`/`primary`variantは、既存の`.secondary`/素の`button`スタイルとほぼ同一の配色（背景・文字色・枠線）で、視覚的な差分は最小限（枠線の色トークンが`--border-strong`→`--border-subtle`へ変わる程度）。
- `danger`variantは、既存の`.danger`（`--danger-soft`背景+`--danger`文字の淡色アウトライン調）から、`DESKTOP_CREATIVE_STUDIO_SPEC.md`§3.1で定義された塗りつぶし調（`--danger`背景+`--text-primary`文字）へ**意図的に変化**する。これは仕様に基づく意匠アップデートであり、削除操作としての視認性は損なわれない（むしろ警告色の彩度が上がる）。

これ以外のレイアウト・配置・余白・グリッド構成には一切変更がない。

## 4. 機能面の回帰防止

- 新規Projectモーダルの「作成」ボタンは、`<form onSubmit={create}>`内で暗黙的に`type="submit"`として機能していた。Buttonコンポーネントは`type`の既定値を`"button"`にしているため、変換時に`type="submit"`を明示的に指定した。`apps/desktop/tests/design-home-screen.test.mjs`でこの点を機械的に確認している。
- `newProjectButtonRef`（`React.useRef<HTMLButtonElement>`）は、`Button`が`React.forwardRef<HTMLButtonElement, ButtonProps>`であるため、型・実行時挙動とも変更なく動作する。

## 5. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `apps/desktop/src/renderer/main.tsx` | Home画面の11箇所の`<button>`を`Button`コンポーネントへ置き換え（テキスト・ロジックは無変更） |
| `apps/desktop/tests/design-components.test.mjs` | 「新規コンポーネントは未適用」テストからButtonを除外し、Card/FormField/FloatingToolbarのみを引き続き検査するよう更新 |
| `apps/desktop/tests/design-home-screen.test.mjs`（新規） | Buttonのimport、主要操作への適用、Create ボタンの`type="submit"`維持、`.project-open`が未変更であることを確認する4件のテスト |
| `apps/desktop/package.json` | `test`スクリプトへ`tests/design-home-screen.test.mjs`を追加 |
| `docs/design/PHASE_D3_HOME_SCREEN.md`（本ファイル、新規） | 本記録 |
| `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md` | 更新 |

## 6. テスト結果

`design/phase-d3-home-screen`ブランチ（base: `feature/manga-canvas-mvp` @ `2b4f97d`）で実行。

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**124/124**。既存120件 + 新規`design-home-screen.test.mjs` 4件、既存`design-components.test.mjs`は更新のうえ回帰なし） |
| `npm run desktop:test:a11y`（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT（本コンテナにXサーバーがなくElectron起動不可。Phase D1/D2と同一要因。**本フェーズは特にこの制約のためスコープを絞った**） |
| `npm run desktop:build` | PASS |
| `git diff --check` | PASS |

## 7. 変更していないこと

- Projectカードのグリッドレイアウト・カバー画像・hoverケバブメニュー
- フィルタchip（すべて/最近/お気に入り）の新設
- 下部ステータス帯の新設、自動バックアップ状態の`StatusBadge`化
- コマンドパレットトリガーの上部バー設置
- 新規Projectモーダルのフォーム項目（label/input/select）の`FormField`化
- API、DB、Storage、Desktop IPC
- 新規依存パッケージの追加、Tailwindの導入

## 8. ロールバック方法

1. **本PR全体の取り消し**: ブランチ・PRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（未マージの間）。
2. **Button適用のみを取り消す**: `main.tsx`の`Button`要素を元の`<button>`へ戻し、`import { Button } ...`の行を削除すれば、Phase D2完了時点の状態へ戻る（Buttonコンポーネント自体は他で使われていないため削除しても影響がない）。
3. DB migration、API、Storage、IPCへの変更は一切ないため、ロールバックにデータ影響はない。

## 9. 次フェーズへ進む条件

- [ ] 本PRが責任者レビューを受け、`feature/manga-canvas-mvp`へmergeされること
- [ ] Home画面のカードグリッド化・下部ステータス帯・フィルタchip等の全面ビジュアル刷新は、目視確認が可能な環境（Windows実機やGitHub Actions上でのスクリーンショット取得等）が整うか、責任者が「見た目の差分をレビューなしで進めてよい」と明示判断してから着手する
- [ ] `Card`/`FormField`/`FloatingToolbar`/`CommandPalette`の画面適用も同様に、目視確認手段の確保を前提とする
