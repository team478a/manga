# MANGAI UI刷新計画（UI Redesign Plan）

作成日: 2026-07-26（Phase D0.5追記: 同日）
状態: **調査完了（Phase D0承認済み）。「MANGAI Creative Studio」の方向性は責任者承認済み。[`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)の画面別「デザイン承認条件」は未承認、コード変更なし**。実装は、保守性改善stackの統合方針と同文書の承認の両方が揃ってから、統合済み基準ブランチ上の新しい実装ブランチで開始する。

本ブランチ（`design/mangai-ui-refresh`）は`handoff/codex-to-claude-20260725`から分岐しており、最新の`feature/manga-canvas-mvp`とも乖離しているため、**本ブランチではUIコード・CSS・Tailwind設定・Reactコンポーネントの実装を行わない**。Phase D0.5を含め、実装着手までは文書更新のみを行う。

前提文書: [`CURRENT_UI_AUDIT.md`](CURRENT_UI_AUDIT.md)（現状監査）、[`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md)（トークン・コンポーネント案）、[`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md)（画面一覧）、[`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)（「MANGAI Creative Studio」4画面詳細ビジュアル仕様・Phase D0.5の正本）

---

## 1. 本計画のスコープと非スコープ

### スコープ（実施する）

- 見た目・UIコンポーネント構造の刷新（デザイントークン適用、共有コンポーネント抽出、God Componentの画面表示層のみの分割）

### 非スコープ（実施しない・変更禁止）

`CURRENT_UI_AUDIT.md`§8と同一。再掲:

- ビジネスロジック、API/DB/Storage/Desktop IPC契約
- Canvas保存処理（revision競合、autosave再試行ロジック）
- AI生成ルーティング（Generation Router、safe/adult分類、fail-closed判定）
- 認証・決済処理
- 機能削除

画面のリファクタリングでロジックを含むファイルを分割する場合も、**ロジック（state管理・API呼び出し・バリデーション）とビュー（JSX/見た目）を分離するだけ**とし、ロジックの挙動そのものは変更しない。挙動変更が必要になった場合は本計画を止め、責任者に確認する。

---

## 2. 画面ごとの変更優先順位

優先順位は「God Component化の深刻度」「ユーザー接触頻度」「変更リスク（ビジネスロジック密結合度）」の3軸で判定。**リスクが高い画面ほど後回し**にする（先に低リスク・高頻度の画面でコンポーネントライブラリを確立し、そのうえでリスクの高いCanvas Editor等に適用する）。

### Desktop

| 優先度 | 画面 | 理由 |
| --- | --- | --- |
| P1 | 共有コンポーネント基盤（Button/Modal/Card/FormField/EmptyState） | すべての画面変更の前提。ここが確立しないと各画面の刷新が重複作業になる |
| P1 | Global Nav / App Header / Status Bar（シェル） | 全画面共通シェル。他画面への影響が最も大きく、最初に統一すべき |
| P2 | Project一覧（Home） | 高頻度接触、ロジックが比較的軽い（Project CRUD中心） |
| P2 | 新規Project modal | Modal共通化の実証実装として適する |
| P2 | Export Dialog | 既存実装の完成度が高く、Modal共通化のリファレンス実装に使える |
| P3 | Character Profile Manager / Project Generation Policy Settings | 中規模、ロジックとビューの分離がしやすい |
| P3 | Settings（AISettings/DezgoSettings/AdultGenerationSettings） | `SettingsShell`の新設と合わせて刷新。ロジック（provider設定の保存）は変更しない |
| P4 | Hub連携（HubStatus） | 端末認証フローに触れるため慎重に。表示層のみ分離 |
| P4 | Creator Chat | チャットの型安全性（`any[]`）に手を入れたくなる誘惑があるが、本フェーズでは見た目のみ |
| P5 | Workspace Status Controls / 画像生成Job（GenerationJobs） | Job状態・外部dispatch確認等、ロジック密結合度が高い。P1〜P4で確立したパターンを適用する形で最後に着手 |
| P6 | **Manga Canvas Editor** | 最大リスク・最大規模。Canvas保存処理・Konva描画に触れずツールバー/プロパティパネルのUIのみ段階的に分離する。最後に着手し、他画面よりも小さい単位（ツールバーのみ→プロパティパネルのみ→レイヤーUIのみ）でPRを分割する |

### Hub

| 優先度 | 画面 | 理由 |
| --- | --- | --- |
| P1 | 共有コンポーネント基盤（Button/Card/FormField/PageHeader/FlashMessage/EmptyState/StatusPill） | Desktopと同様、前提基盤 |
| P1 | 区画別layout.tsx新設（`dashboard/layout.tsx`、`admin/layout.tsx`） | adminナビ不在という機能的な穴を埋めつつ、以降の画面刷新のシェルを用意する |
| P2 | 公開マーケットプレイス（`/`、`/works`、`/works/[id]`） | 最も外部露出が高く、SEO/第一印象に直結。ロジックが軽い（読み取り中心） |
| P2 | 認証画面（`/login`、`/signup`） | 小規模、高頻度、リスク低 |
| P3 | Dashboard一覧系（works/products/sales/purchases/goods-requests） | `RowCard`/`DataTable`/`PageHeader`の実証実装 |
| P3 | Checkoutフロー（`/checkout/*`） | `ResultPanel`共通化。決済ロジックには触れず表示のみ |
| P4 | Dashboard詳細/フォーム系（works/new・edit、products/new・edit、billing、devices） | `FormField`適用 |
| P4 | Admin一覧系（users/works/products/orders/goods-requests） | Dashboard一覧系のパターンを流用 |
| P5 | `admin/cloud-ai` | 品質劣化が著しく、UI刷新の前に型・構造の最低限の整理（ロジック変更なし、コンポーネント分割のみ）が必要。単独タスクとして扱う |
| P5 | `SalesPackageImport.tsx` | 493行のGod Component。ZIP検証ロジックとビューの分離が前提 |
| P6 | **Cloud Canvas Editor** | Desktop Canvas同様、最大リスク。二重ヘッダー問題の解消（レイアウト統合）を含めて最後に、最小単位で段階着手 |

---

## 3. 段階的な実装計画

デザイン方針承認後、以下のフェーズで進める。各フェーズ終了時に品質ゲートを実行し、結果を`docs/CURRENT_TASK.md`相当（本ブランチでは`docs/design/`配下に進捗を記録する運用を想定、詳細は責任者判断）へ記録する。

### Phase D0（完了）

現状調査・設計文書作成のみ。コード変更なし。2026-07-26付でCURRENT_UI_AUDIT.md／UI_REDESIGN_PLAN.md／DESIGN_SYSTEM.md／SCREEN_INVENTORY.mdの調査結果を責任者が承認済み。

### Phase D0.5: ビジュアル方針確定（コード変更なし）

**状態**: 方向性は責任者承認済み（2026-07-26、「MANGAI Creative Studio」コンセプト）。**画面仕様の正本は[`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)。**

**目的**: Phase D1以降でコードへ反映する前に、対象4画面（Desktopホーム／制作ワークスペース／AI画像生成／設定画面）のビジュアル仕様を文書として確定する。本フェーズはコード変更を一切行わない。

**経緯**: 2026-07-26、責任者から「既存デザインの微調整ではなく、最新のプロ向けAIクリエイティブツール（コンセプト名『MANGAI Creative Studio』）として再設計する」との指示があり、Linear/Figma/Raycast/Adobe系ツール/最新OSの奥行き表現を参照した詳細仕様を作成した。対象もProject一覧／制作ワークスペース／設定画面の3画面から、AI画像生成を独立画面として追加した4画面へ拡張している。

初回イテレーション（3画面版のワイヤーフレーム・SettingsShellタブ構造案・旧1365pxブレークポイントのままの記述等）は履歴として[`ARCHIVE_PHASE_D0.5_INITIAL_DRAFT.md`](ARCHIVE_PHASE_D0.5_INITIAL_DRAFT.md)へ移動した。**画面仕様・ワイヤーフレーム・コンポーネント仕様・レスポンシブ配置・状態別仕様・アクセシビリティ要件・デザイン承認条件は、すべて`DESKTOP_CREATIVE_STUDIO_SPEC.md`を参照すること。本ファイルに旧仕様を再掲しない。**

---

### Phase D1: トークン導入（見た目の変更を最小化した基盤整備）

**着手条件**: [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)の4画面（Desktopホーム／制作ワークスペース／AI画像生成／設定画面）のビジュアル仕様が責任者承認を得ていること、かつ保守性改善stackの統合方針が確定していること（両方が揃うまで着手しない）。

- Desktop: `styles.css`の`:root`変数を`DESIGN_SYSTEM.md`§2の命名へ整理（値はほぼ現状維持、まず命名を揃える）
- Hub: `tailwind.config.ts`のtheme拡張を`DESIGN_SYSTEM.md`§2に合わせて整理
- 見た目の変化は最小限（リファクタリングに近い）。既存の`npm run desktop:test:a11y`、visual regressionがあれば実行して差分ゼロを確認

### Phase D2: 共有コンポーネントライブラリの新設

- `DESIGN_SYSTEM.md`§3の共通コンポーネント（Button/Modal/Card/FormField/EmptyState/StatusBadge等）をDesktop・Hubそれぞれの技術スタックで実装
- 既存画面には適用しない（コンポーネントの単体テスト・Storybook的な確認のみ）

### Phase D3: 低リスク画面への適用（P1〜P3画面）

- 画面単位でPRを分割し、1画面ずつ新コンポーネントへ置き換え
- 各PR: 該当画面のみの差分、既存の`data-a11y-*`属性・aria属性・i18nキーを保持したまま実施
- 各PR後に該当する品質ゲート（§4）を実行

### Phase D4: 中リスク画面への適用（P4画面）

- フォーム・設定画面。ロジック（バリデーション、保存処理）に触れず、表示層のみ置き換え

### Phase D5: 高リスク画面への適用（P5画面）

- `GenerationJobs.tsx`、`admin/cloud-ai`、`SalesPackageImport.tsx`等。ロジックとビューの分離を先に行い、分離後のビュー部分のみコンポーネント置き換え

### Phase D6: Canvas Editor（P6画面、最終フェーズ）

- Desktop `MangaCanvas.tsx`、Hub `CloudCanvasEditor.tsx`
- ツールバー→プロパティパネル→レイヤーUIのように機能単位でさらに細分化してPRを作る
- Canvas保存処理（autosave、revision競合）、Konva描画ロジック、`panels`/`panel_layers`の永続化には一切触れない
- 各細分化PRごとに`npm run canvas:test`、`npm run desktop:test`（Desktop）、`npm run hub:test`（Hub）を実行

各フェーズの着手前に、フェーズ内で影響する画面と非スコープの再確認を行う。フェーズ間で責任者の承認チェックポイントを設ける（特にD1→D2、D5→D6の前）。

---

## 4. テスト方法

### 4.1 自動テスト（既存の品質ゲートを流用）

| コマンド | 目的 | UI変更時の意味 |
| --- | --- | --- |
| `npm run lint` | 静的解析 | コンポーネント分割後のimport/exportミス検出 |
| `npm run typecheck` | 型検査 | props変更・コンポーネントAPI変更の破壊的変更検出 |
| `npm run hub:test` | Hub Server Action/API/Domain Error回帰 | UIのみの変更でもServer Actionへの引数変更があれば検出 |
| `npm run canvas:test` | canvas-core単体テスト | Canvas Editor刷新時のデータモデル非破壊確認 |
| `npm run ai:test` | ai-core単体テスト | 画像生成Job画面刷新時のルーティングロジック非破壊確認 |
| `npm run desktop:test` | Desktop統合テスト（98件） | UI操作（ドラッグ&ドロップ、export、backup等）の回帰確認。**画面刷新で最も頼りになる自動テスト** |
| `npm run desktop:test:a11y` | axe監査 | 既存29状態で違反0件を維持することを毎フェーズ確認 |
| `npm run build` / `npm run desktop:build` | 本番ビルド成功確認 | ― |

### 4.2 手動確認（自動テストで担保できない範囲）

- 各フェーズ完了時に対象画面をブラウザ/Electronで実際に操作し、golden path（主要フロー）とedge case（空状態、エラー状態、長い文字列）を確認
- Desktop: ダークテーマでの視認性、`forced-colors`（Windows High Contrast）モードでの表示、`prefers-reduced-motion`有効時の挙動
- Hub: レスポンシブ確認（既存のブレークポイント: 1365px/1200px/850px/650px相当、TailwindのSM/MD/LG/XL）
- i18n: Desktopはja/en両方で確認（`i18n.tsx`のキー追加時、型エラーで検出されるが目視確認も行う）
- スクリーンリーダーでの主要フロー確認（可能な範囲で。実機Windows Narrator確認は既存のBLOCKED_EXTERNAL_ENVIRONMENT項目と同様、環境依存で別途記録)

### 4.3 変更してはいけないことの確認方法

- 各PRのdiffで、`CURRENT_UI_AUDIT.md`§8に列挙したファイル（Server Actions、API Routes、IPC、SQLite schema、Domain Errors等）が**含まれていないこと**をレビュー時に確認する
- Canvas Editor刷新時は特に、`useCanvasAutosave.ts`・`MangaCanvas.tsx`内のstate更新ロジック・`panels`/`panel_layers`保存呼び出しに差分がないことを確認する

---

## 5. ロールバック方法

1. 各フェーズ・各画面のPRは小さく保ち、1PR = 1画面（またはCanvas Editorのように1機能単位）とする。問題発生時は該当PRのみをrevertすれば良い状態を維持する。
2. 共有コンポーネント（Phase D2）は、既存画面が新コンポーネントへ切り替わるまで**並行して旧実装を残す**（例: 旧`.panel-lite`クラスは残したまま新`Card`コンポーネントを追加し、画面ごとの移行が終わった後にのみ旧CSSクラスを削除する）。これにより、移行途中の画面で問題が出ても新コンポーネント側だけをrevertできる。
3. デザイントークン導入（Phase D1）は、CSS変数/Tailwind theme拡張のみの変更とし、既存のセレクタ・クラス名は変更しない。値を旧に戻すだけで即座にロールバックできる。
4. Canvas Editor（Phase D6）のように保存処理に近い画面は、機能フラグ的な分離が難しい場合、**該当PRのブランチをmainへmergeする前に、Desktop実機での動作確認と`desktop:test`全件成功を必須条件とする**。
5. 各PRのコミットメッセージに変更対象画面と非スコープ遵守を明記し、`docs/design/`配下（または責任者が指定する進捗記録先）に実施結果を記録する。

---

## 6. 未決事項

1. ~~デザイン方針そのもの（配色統一の有無）~~ → **2026-07-26責任者指示により一部確定**: Desktopはダークテーマ・紫系アクセントを維持（現状維持で確定）。DesktopをTailwindへ移行しないことも確定。Hub側の配色・ダークモード追加要否は引き続き未決（`DESIGN_SYSTEM.md`§5参照、Hubのデザイン実装はDesktop確定後に着手するため優先度は低い）。
2. 本計画のPhase D1着手時期は、保守性PRスタック統合（`handoff/codex-to-claude-20260725`側の課題）とビジュアル仕様確定（Phase D0.5）の**両方**が完了してからとすることが確定。
3. Storybook等のコンポーネントカタログツール導入の要否（Phase D2の効率化に寄与するが、新規ツール導入のため要判断）。
4. Visual regressionテスト（Chromatic等）導入の要否。
5. [`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)§4各画面末尾および§8に列挙した個別確認事項。

---

## 7. 現時点でのステータス

### Phase D0（完了・承認済み）

- [x] Desktop全画面構成の調査
- [x] Hub全画面構成の調査
- [x] 共通レイアウト・ナビゲーション・ヘッダー・サイドバー・ボタン・フォーム・モーダル・カードの現状調査
- [x] Canvas Editor・Creator Chat・画像生成画面・設定画面・プロジェクト一覧・Hubダッシュボード・管理画面の調査
- [x] レスポンシブ対応・ダークモード/テーマ管理の有無の調査
- [x] 固定色・固定余白・固定フォントの散在状況の調査
- [x] 再利用できるUIコンポーネントの調査
- [x] 巨大化している画面コンポーネントの特定
- [x] `docs/design/CURRENT_UI_AUDIT.md`作成
- [x] `docs/design/UI_REDESIGN_PLAN.md`作成（本文書）
- [x] `docs/design/DESIGN_SYSTEM.md`作成
- [x] `docs/design/SCREEN_INVENTORY.md`作成
- [x] Phase D0調査結果の責任者承認（2026-07-26）

### Phase D0.5（進行中・コード変更なし）

- [x] Desktop Project一覧／制作ワークスペース／設定画面のビジュアル仕様・初回イテレーション（履歴化: [`ARCHIVE_PHASE_D0.5_INITIAL_DRAFT.md`](ARCHIVE_PHASE_D0.5_INITIAL_DRAFT.md)）
- [x] 「MANGAI Creative Studio」コンセプトへの再設計指示を反映した詳細仕様を作成（[`DESKTOP_CREATIVE_STUDIO_SPEC.md`](DESKTOP_CREATIVE_STUDIO_SPEC.md)、対象をAI画像生成画面を含む4画面へ拡張）— **画面仕様の唯一の正本**
  - 基盤トークン拡張案（elevation/glass/accent-active/spacing/type/radius/motionスケール）
  - 共通コンポーネント仕様（Button/Card/StatusBadge/コマンドパレット(Ctrl+K)/FormField/フローティングツールバー）
  - 4画面（Desktopホーム／制作ワークスペース／AI画像生成／設定画面）それぞれの1920×1080・1366×768レイアウト、領域幅・余白・色・文字サイズ、主/副操作優先順位、初回フロー、空/エラー/生成中/blocked状態、狭幅時の挙動
  - ブレークポイント再編案（現行1365px境界の解消）
  - アクセシビリティ要件、デザイン承認条件
- [ ] `DESKTOP_CREATIVE_STUDIO_SPEC.md`§8「デザイン承認条件」の責任者承認（未着手）
- [ ] 保守性改善stack（`handoff/codex-to-claude-20260725`）の統合方針確定（本計画の管理外、統合方針が決まり次第Phase D1の着手可否を再判断）

**Phase D0.5完了条件**: 上記2項目（`DESKTOP_CREATIVE_STUDIO_SPEC.md`のビジュアル仕様承認、保守性改善stack統合方針の確定）が揃うこと。揃うまでPhase D1（コード変更を伴うトークン導入）には着手しない。本ブランチ（`design/mangai-ui-refresh`）でのUIコード実装は行わない。
