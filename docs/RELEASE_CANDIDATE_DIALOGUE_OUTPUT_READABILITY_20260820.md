# MANGAI Release Candidate: Dialogue Output Readability

作成日: 2026-08-20
Branch: `codex/fix-r4-3-dialogue-output-readability`
Base: `ea302207328faee8a647029cf528e55143f2b206`（PR #323 merge commit）

## 結論

必須セリフがデータ上存在しても、販売原稿上で読めない配置を完成扱いにしない。横長吹き出しの短文は、文字内容と既存領域を維持したまま、追加生成なしで可読サイズの1行横書き中央へ修復できる。

## Production read-only監査

- 対象: `test`の既存作品22ページ。
- 必須セリフ: `（証拠を）`、配置数1/1。
- 保存状態: 画像4/4、revision 11/11、PNG成功。
- 品質事象: 42pxの短い縦書きが横長領域で6列に分割された。
- 表示事象: 720px幅のCanvasに対し、文字の`cqw`が1280px viewport基準となり、正しい18.9px相当ではなく33.6px相当で表示された。
- credit: 使用80、予約0、残り20。
- 書込み、Provider実行、Job作成、Asset作成、クレジット消費: 0件。

## 変更契約

1. Canvas rootをContainer Queryの基準にし、Editor表示と保存Canvas／PNGの縮尺を一致させる。
2. 6文字以下かつ改行なしの短文は、横長領域なら24px以上で収まる1行横書きを優先する。
3. 横書き短文は左右中央・上下中央へ配置する。
4. 既存の短い複数列縦書きは、利用者の明示した「追加生成なし修復」だけで更新する。
5. 完成判定は、縦書き短文の複数列、横書き短文の複数行、overflowを`DIALOGUE_LAYOUT_UNREADABLE`として阻止する。

## 回帰テスト

- 横長吹き出しへの新規短文配置: 32px、横書き、1行、中央。
- 既存`（証拠を）`修復: 内容・座標・領域を維持し、32px横書き中央へ更新。
- locked、既存横書き、長文: 修復対象外。
- 完成判定: 読めない縦書き6列はincomplete、横書き1行への修復後は当該blocker解消。
- SVG／PNG: `（証拠を）`を32pxの単一textとして描画し、320×480 PNGを生成。
- Editor UI: `containerType`はCanvas rootに1件だけ存在。

## 品質ゲート

- 集中特性: 53/53成功。
- Dependency boundaries: error 0、既存warning 2件。
- lint: 成功。
- Hub／Desktop typecheck: 成功。
- Hub: 829/829成功。
- Canvas: 26/26成功。
- AI: 48/48成功。
- Desktop: 182/182成功。
- Desktop a11y: violation 0。
- Supabase migration: 61件検証成功。
- Hub build／Desktop build: 成功。
- RC structure／`git diff --check`: 成功。
- RC外部設定: ローカル秘密情報未設定のため従来どおりPending。今回の変更由来ではない。

## 変更しないもの

セリフ本文、Canvas schema、PNG／PDF renderer、API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、成人向け境界、Desktop製品コードは変更しない。

## Draft PRとPreview

- Draft PR: [#324](https://github.com/team478a/manga/pull/324)、MERGEABLE。
- 実装HEAD: `fc4c77d39352ccf0c71e434cfbf98dd8f27e28b2`。
- Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Comments: すべて成功。
- Preview: [Ready](https://mangai-hub-staging-git-codex-fix-r4-3-7d36ca-team478as-projects.vercel.app)。

Previewでの受入れ項目:

1. 既存fixtureまたはPreview用データで修復候補件数を確認する。
2. 「追加生成なし修復」を実行し、短文が1行横書き中央になることを確認する。
3. 保存後のEditor、原稿プレビュー、PNGで文字内容・大きさ・位置が一致することを確認する。
4. 追加Job・追加Asset・クレジット消費がないことを確認する。

Productionではmergeと責任者確認前に修復・保存を行わない。
