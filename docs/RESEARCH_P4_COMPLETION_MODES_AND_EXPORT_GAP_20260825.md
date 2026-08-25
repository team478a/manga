# P4 用途別完成モード・書き出し gap監査

## 1. 結論

P4は書き出しエンジンの新規構築ではない。Hub／Desktopにはページ合成、連番PNG、PDF、Project JSON、販売パッケージ、長編durable PDF、完成前preflightが既にある。

主要gapは、長編ストーリー漫画、Kindle向け解説漫画、成人向け漫画を表す共通の完成モード正本がなく、寸法・推奨コマ数・セリフ量・品質検査・出力形式がProject作成、preflight、exportへ一貫して伝播しないことである。既存exportを置換せず、mode profileを入力側へ追加する。

## 2. 現行経路

### Hub互換書き出し

1. `POST /api/creator/projects/[projectId]/export`が`pdf | images | package`を検証する。
2. owner workspace、最新Canvas snapshot、Project Assetを読み、SHA-256とbyte数を検証して一時領域へstageする。
3. 各ページをPNGへ合成し、ページ番号順に`001.png`形式で整列する。
4. PDFはProject DPIからページ寸法を計算する。imagesは連番PNG ZIP、packageはPDF、PNG ZIP、表紙、Project JSON、販売文、manifestをZIP化する。
5. 応答終了後に一時領域を削除する。長編は互換routeではなくdurable exportへ誘導する。

### Hub長編durable PDF

1. 完成判定と原稿preflightで全ページ確定、active generationなし、表紙、画像、文字配置を確認する。
2. DB jobを作成し、4ページsegmentでlease／checkpointしながらPNGとsegment PDFをStorageへ保存する。
3. 最終segmentでPDFを結合し、ownerだけが5分の署名URLから取得する。
4. 現行durable formatは`pdf`固定で、images／Project JSONは対象外。

### Desktop

1. ローカルProject bundleから全ページをPNG合成する。
2. PDF、連番PNG ZIP、完全な`作品情報.json`、販売文、販売パッケージを作成する。
3. 一般向けProjectだけCloud移行JSONも作成し、成人向けはCloudへ出さない。
4. 成人向けを含むProjectはローカルPDF／ZIP／販売パッケージへ書き出せる。Provider送信とは独立している。

## 3. 要求との対応

|要求|現状|gap|
|---|---|---|
|長編ストーリー漫画|100ページ管理、完成判定、durable PDFあり|modeとして保存されず、推奨構成・検査profileがない|
|Kindle向け解説漫画|縦横寸法、DPI、PDF、PNGあり|Kindle profile、セリフ量、ページ寸法preset、専用preflightがない|
|成人向け漫画|Desktop local-only、PDF／PNG ZIP／Project JSON／販売packageあり|P4 mode契約との接続がない。Cloudへ保存してはならない|
|PNG/JPEG|PNGページとPNG ZIPあり|JPEG選択、品質値、透過／色空間方針がない|
|PDF|Hub互換、Hub durable、Desktopに実装済み|mode別の綴じ方向・表紙・寸法検査がない|
|Project JSON|Hub package内とDesktop単体に存在|Hub単体downloadと共通versioned schemaがない|
|ページ寸法|Project width／height／dpiを保存|mode presetと既存Projectへの非破壊適用がない|
|推奨コマ数／セリフ量|Canvas、文字overflow検査あり|mode別warning閾値がない|
|品質検査切替|共通preflightとP3 findingあり|mode profileから必須検査を解決しない|

## 4. 維持する安全境界

- 一般向けCloudと成人向けDesktopの保存・生成・export境界を統合しない。
- 成人向けProject、Prompt、画像、完成ページをHub／Cloud Storageへ送らない。
- 既存`pdf | images | package` API、durable PDF、販売package v2、Desktop backup／Cloud移行JSONを削除・変更しない。
- mode変更で既存ページ寸法やCanvasを自動変換しない。差分previewと利用者確認を必須にする。
- preflight warningだけでページ、Asset、Job、候補を削除しない。
- EPUB／KDP詳細、SNS動画、YouTubeはP4初期対象外。

## 5. 追加する完成モード契約

domainへProvider非依存のversioned profileを追加する。

```ts
type CompletionMode = "longform_story" | "kindle_explainer" | "adult_local";

type CompletionModeProfile = {
  version: 1;
  mode: CompletionMode;
  executionSurface: "cloud_general" | "desktop_local";
  pagePreset: { width: number; height: number; dpi: number; readingDirection: "rtl" | "ltr" };
  guidance: { panelsPerPage: { min: number; max: number }; maxDialogueGraphemesPerPanel: number };
  requiredChecks: string[];
  allowedExports: Array<"png" | "jpeg" | "pdf" | "project_json">;
};
```

数値presetは責任者が確認できる仕様表として先に固定し、実装中にKindle要件を推測しない。成人向けprofileは`desktop_local`以外をschemaで拒否する。

## 6. 実装PR分割

1. P4-A: 完成モード／profileの純粋schema、Cloud／Desktop実行surface境界、version、固定fixture。既存Projectはmode未設定を許容し従来動作を維持。
2. P4-B: 新規Project作成時の3 mode選択とpreset preview。既存Projectへの適用は寸法を自動変更せず、mode metadataだけを明示保存する。
3. P4-C: mode別preflight。推奨コマ数とセリフ量はwarning、Asset欠落・文字切れ・未確定ページは従来どおりerror。P3 findingをread-only参照する。
4. P4-D: Hub単体Project JSONと長編durable images／JSON。既存互換exportとStorage pathを維持し、新formatはFeature Flag既定OFFで追加する。
5. P4-E: JPEG adapterをexport-coreへ追加。quality、背景flatten、拡張子、MIME、manifest hashを決定論的に検証する。PNG既定を維持。
6. P4-F: 3 mode固定作品でPNG／JPEG／PDF／Project JSON、保存再読込、順序、寸法、文字、owner境界、成人向けCloud拒否を受入検証する。

## 7. 受入条件

- mode未設定の既存Projectは現在と同じPNG／PDF／packageを書き出せる。
- 3 modeのsurface、寸法preset、推奨コマ数、セリフ量、検査、許可formatをversion付きで追跡できる。
- mode適用だけで既存Canvas、Asset、Job、credit、ページ寸法を変更しない。
- 長編は中断再開可能なPDF／画像／Project JSONをページ順どおり出力できる。
- Kindle profileは承認済み仕様値と異なる寸法・文字量をwarningできる。
- 成人向けprofileはDesktop内だけでPDF／画像／Project JSONを作り、Cloud exportをfail closedする。
- Project JSONはschema version、mode version、Project／page／Canvas参照、export provenanceを持ち、再読込で一致する。

## 8. 今回の変更境界

調査文書と引継ぎ正本だけを変更する。製品コード、API、DB、migration、Storage、Provider、Job、credit、Production／stagingは変更しない。

## 9. 検証

- Hub 889/889、Canvas 26/26、AI 48/48、Desktop 182/182
- a11y violation 0、migration 72件
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
