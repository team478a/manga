# P4-F completion mode／export acceptance

## Scope

- Base: PR #367 merge commit `eb9e9dd`.
- 長編ストーリー、Kindle解説、成人向けローカルの固定3作品をrepository-only fixtureで検証する。
- 外部Provider、Production／staging、Worker／Job、credit、Storageを使用しない。

## Fixture

- 各作品は承認済みmode profileの実寸、DPI、綴じ方向を使用する。
- 入力ページを意図的に逆順で保持し、export時に1→2ページへ整列する。
- 各ページに独立した文字レイヤーを保持し、JSON保存・再読込後も内容と位置を維持する。
- 成人向けfixtureは分類境界だけを検証する安全な合成画像であり、成人向けコンテンツを含まない。

## Acceptance

- PNG: 実寸と連番を確認する。正式PNG許可はprofileに従い、Kindleでは生成物として公開しない。
- JPEG: `.jpg`、`image/jpeg`、実寸、順序、manifest integrityを確認する。
- PDF: 2ページ、順序、DPI換算後の実寸を確認する。
- Project JSON: mode profile、1→2ページ順、文字レイヤー、保存再読込一致を確認する。
- Boundary: Cloud profile／DBは`adult_local`を拒否し、Project作成とexport履歴は認証ownerへ限定する。

## Result

- 集中受入テスト4/4成功。
- 製品コード、API、DB、migration、UI、既存export形式は変更しない。

## P4 closeout

- P4-A〜Fのrepository実装・受入fixtureは完了。
- migration適用、Feature Flag変更、実Storage／Workerを使うstaging受入れは別承認事項として残す。
