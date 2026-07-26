# Phase D2: MANGAI Desktop共通コンポーネント（単体実装）

作成日: 2026-07-26
状態: 実装完了（コード変更あり）。既存画面への適用は未着手。
ブランチ: `design/phase-d2-desktop-components`（base: `feature/manga-canvas-mvp` @ `5e54a8d`、PR #35・#36マージ後）

正本: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§3、[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)§3

## 1. 実装したコンポーネント

`apps/desktop/src/renderer/components/common/`配下に、Phase D1で追加したデザイントークンを実際に消費する共通コンポーネントを実装した。いずれも**単体のReactコンポーネントとして実装するのみ**で、既存画面（Home、制作ワークスペース、AI画像生成、設定画面等）へは適用していない。

| コンポーネント | ファイル | 仕様参照 |
| --- | --- | --- |
| `Button`（新規） | `Button.tsx` | §3.1。`variant: primary\|secondary\|ghost\|danger`、`size: sm\|md\|lg` |
| `Card`（新規） | `Card.tsx` | §3.2。`variant: static\|interactive`、`density: standard\|compact`。interactiveはEnter/Spaceキーでも起動可能 |
| `StatusBadge`（既存へ追加） | `StatusBadge.tsx` | §3.3。既存5種類の`tone`は変更せず、独立した`activity?: "running"`propを追加 |
| `FormField`（新規） | `FormField.tsx` | §3.5。`label`/`error`/`hint`/`required`/`density`。render props形式で入力要素へ`id`・`aria-describedby`・`aria-invalid`を渡す |
| `FloatingToolbar`/`FloatingToolbarGroup`（新規） | `FloatingToolbar.tsx` | §3.6。`role="toolbar"`、glassトークン（一時UI限定）を使用する唯一のコンポーネント |

**コマンドパレット（§3.4）は本フェーズのスコープ外**とした。Phase D1完了報告・`docs/CURRENT_TASK.md`のPhase D2着手条件で明示的に列挙されていたのは「Button、Card、StatusBadge、FormField、フローティングツールバー等」であり、コマンドパレットは含まれていない。コマンドパレットはグローバルショートカット（Ctrl+K）・フォーカストラップ・「設定画面のAI Providerセクションを開くだけで即時切替はしない」という安全境界（§3.4）を伴う、より複雑で画面横断的なコンポーネントであるため、独立した検討・実装フェーズとして別途着手することを提案する。

## 2. 新規CSSクラス（`ds-`プレフィックス）

既存のコンテキスト依存クラス（`.toolbar button`、`.app-header-actions > button`等）と衝突しないよう、新規共通コンポーネント専用のクラス名には`ds-`（design system）プレフィックスを付けた。`apps/desktop/src/renderer/styles.css`末尾に追加（既存ルールは1つも変更していない）。

- `.ds-button` / `.ds-button-{primary,secondary,ghost,danger}` / `.ds-button-{sm,md,lg}`
- `.ds-card` / `.ds-card-{static,interactive}` / `.ds-card-density-{standard,compact}`
- `.ds-form-field` / `.ds-form-field-density-{standard,compact}` / `.ds-form-field-{label,required,hint,error,invalid}`
- `.ds-floating-toolbar` / `.ds-floating-toolbar-group`
- `.status-badge-activity-running`（既存`.status-badge`系に追加）

すべて、Phase D1で追加したトークン（`--space-*`、`--text-*`、`--radius-*`、`--motion-*`、`--ease-standard`、`--accent-active`、glass系）または既存トークンのみを参照し、新しい色・寸法の生値は導入していない。

## 3. グラス表現の適用範囲（安全境界）

`DESKTOP_CREATIVE_STUDIO_SPEC.md`§2.2の「一時UIのみ」方針に従い、`--bg-glass`/`--glass-blur`/`--glass-border`/`--glass-shadow`を消費するのは`FloatingToolbar`（`.ds-floating-toolbar`）**のみ**。`Button`/`Card`/`FormField`はいずれも不透明な既存トークン（`--bg-panel-elevated`、`--bg-raised`等）を使用し、glassトークンを参照しない。

`forced-colors`（Windows High Contrast）時は、`.ds-floating-toolbar`が既存の`@media (forced-colors: active)`拡張により`backdrop-filter: none`+不透明`--bg-panel`背景+`1px solid CanvasText`へ自動フォールバックする（§2.2で規定済みの挙動を実装）。

`apps/desktop/tests/design-tokens.test.mjs`の該当テストを、Phase D1の「glassトークンは未適用」から、Phase D2の実態に合わせて「glassトークンは`.ds-floating-toolbar`以外の常設UIセレクタへ適用されていない」へ更新した（CSSルールブロック単位でセレクタを検査する機械的チェック。詳細は§6参照）。

## 4. アクセシビリティ

- `Button`: フォーカス時に既存`--focus-ring`を適用。`disabled`時は`cursor: not-allowed`+`opacity: 0.5`。
- `Card`（interactive）: `role="button"`、`tabIndex=0`、Enter/Spaceキーでの起動（`event.currentTarget.click()`によるネイティブclickの発火）。
- `FormField`: `useId()`による一意なid生成、`aria-describedby`（hint/error）、`aria-invalid`、エラーメッセージに`role="alert"`。
- `FloatingToolbar`: `role="toolbar"` + 必須の`label` prop（`aria-label`）。
- `StatusBadge`の`activity="running"`: 色・脈動アニメーションのみに依存せず、既存どおりテキストラベル併記が前提（コンポーネントAPIはchildrenを必須のまま）。脈動は既存のグローバル`@media (prefers-reduced-motion: reduce)`ルール（`animation-duration: 0.01ms !important`、`animation-iteration-count: 1 !important`）により自動的に実質静止表示へフォールバックする。新規の個別`prefers-reduced-motion`ルールは追加していない（既存のグローバルルールで足りるため）。

## 5. 変更していないこと

- Home画面のカード化、AppHeaderの高さ変更、GlobalNavの幅変更、Project一覧レイアウト変更
- コマンドパレット実装（§1参照、本フェーズのスコープ外）
- `MangaCanvas`、`GenerationJobs`、`AISettings`等の既存画面コンポーネントの変更
- API、DB、Storage、IPCの変更
- 新規依存パッケージの追加、Tailwindの導入
- 既存24トークン・Phase D1追加トークンの値変更

`apps/desktop/tests/design-components.test.mjs`の「新規コンポーネントはPhase D2時点でどの既存画面からもimportされていない」テストで、`Button`/`Card`/`FormField`/`FloatingToolbar`が`components/common`以外のどの`.tsx`ファイルからも参照されていないことを機械的に確認している。

## 6. 変更ファイル

| ファイル | 内容 |
| --- | --- |
| `apps/desktop/src/renderer/components/common/Button.tsx`（新規） | Buttonコンポーネント |
| `apps/desktop/src/renderer/components/common/Card.tsx`（新規） | Cardコンポーネント |
| `apps/desktop/src/renderer/components/common/FormField.tsx`（新規） | FormFieldコンポーネント |
| `apps/desktop/src/renderer/components/common/FloatingToolbar.tsx`（新規） | FloatingToolbar / FloatingToolbarGroup |
| `apps/desktop/src/renderer/components/common/StatusBadge.tsx` | `activity?: "running"` propを追加（既存`tone`/`live`は無変更） |
| `apps/desktop/src/renderer/styles.css` | `ds-`系クラス・`status-badge-activity-running`・`.ds-floating-toolbar`用`forced-colors`フォールバックを追加（既存ルールは無変更） |
| `apps/desktop/tests/design-components.test.mjs`（新規） | 新規コンポーネントのprops・CSS・アクセシビリティ属性・未適用（画面からimportされていないこと）を確認する11件のテスト |
| `apps/desktop/tests/design-tokens.test.mjs` | glassトークン検査テストをPhase D2の実態（`.ds-floating-toolbar`のみ許可）に合わせて更新 |
| `apps/desktop/package.json` | `test`スクリプトへ`tests/design-components.test.mjs`を追加 |
| `docs/design/PHASE_D2_IMPLEMENTATION.md`（本ファイル、新規） | 本記録 |
| `docs/CURRENT_TASK.md`、`docs/HANDOFF_LOG.md` | 更新 |

## 7. テスト結果

`design/phase-d2-desktop-components`ブランチ（base: `feature/manga-canvas-mvp` @ `5e54a8d`）で実行。

| コマンド | 結果 |
| --- | --- |
| `npm run deps:check` | PASS（5 packages, 21 source files, 違反0件） |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS（root + Desktop） |
| `npm run desktop:test` | PASS（**120/120**。既存108件 + 新規`design-components.test.mjs` 11件 + 更新済み`design-tokens.test.mjs`の該当1件、回帰なし） |
| `npm run desktop:test:a11y`（ローカル） | LOCAL_BLOCKED_EXTERNAL_ENVIRONMENT（本コンテナにXサーバーがなくElectron起動不可。Phase D1と同一要因、コード変更は行っていない） |
| `npm run desktop:build` | PASS |
| `git diff --check` | PASS |

GitHub Actions Desktop Windows workflow（Accessibility testsを含む）の結果は、push・PR作成後にCIが完了次第確認する。

## 8. ロールバック方法

1. **本PR全体の取り消し**: `design/phase-d2-desktop-components`ブランチとPRをcloseすれば、`feature/manga-canvas-mvp`には一切影響しない（未マージの間）。
2. **コンポーネント追加のみを取り消す**: `apps/desktop/src/renderer/components/common/{Button,Card,FormField,FloatingToolbar}.tsx`を削除し、`StatusBadge.tsx`の`activity`関連の追加分のみを取り除けば、Phase D1完了時点の状態へ戻る。
3. **CSSのみを取り消す**: `styles.css`の`/* Phase D2 (MANGAI Creative Studio) common components. */`コメントから続く追加ブロック、および`.status-badge-activity-running`ルールを削除すれば、見た目・スタイルへの影響もPhase D1完了時点へ戻る。
4. **テストのみを取り消す**: `design-components.test.mjs`を削除し、`package.json`の`test`スクリプトから除去。`design-tokens.test.mjs`の該当テストはPhase D1時点の内容へ戻す。
5. DB migration、API、Storage、IPCへの変更は一切ないため、上記いずれのロールバックもデータ影響はない。

## 9. Phase D3以降へ進む条件

- [ ] 本PR（Phase D2）が責任者レビューを受け、`feature/manga-canvas-mvp`へmergeされること
- [ ] GitHub Actions Desktop Windows workflowでのAccessibility結果がPASSであることを確認すること
- [ ] コマンドパレット（§3.4）の実装要否・実装時期について、責任者の判断を仰ぐこと（本フェーズのスコープ外とした理由は§1参照）
- [ ] 本フェーズで実装した共通コンポーネントを実際の画面（Home、制作ワークスペース、設定画面等）へ適用するのは、責任者の明示判断があるまで着手しない
