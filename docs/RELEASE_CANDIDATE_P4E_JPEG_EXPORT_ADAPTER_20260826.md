# P4-E JPEG export adapter

## Scope

- Base: PR #366 merge commit `9b55f768`.
- `@mangai/export-core/jpeg`へNode専用JPEG adapterを追加する。
- 既存PNG／PDF／Project JSON／販売packageと既定UIは変更しない。

## Contract

- qualityは90、背景は白、chroma subsamplingは4:4:4へ固定する。
- 透過入力は白へflattenし、出力拡張子は`.jpg`、MIMEは`image/jpeg`とする。
- 入力順、宣言寸法、出力寸法を維持し、不一致はfail closedにする。
- manifestはformat/version、encoder設定、順序、寸法、byte size、各JPEGのSHA-256を保持する。
- canonical JSON bytesのSHA-256を`manifestSha256`として返し、同一入力の再実行で同じJPEG／manifest／hashを得る。

## Isolation

- Sharpを使うadapterは専用subpathへ隔離する。ブラウザでも使われる既存main entrypointへNode依存を追加しない。
- PNGを標準出力のまま維持し、P4-Eでは画面・API・DB・migration・Storageを変更しない。
- Production／staging、Provider／Worker、Job、credit操作を行わない。

## Validation

- 集中テスト: quality、白背景flatten、拡張子、MIME、寸法、決定論的JPEG／manifest／hash、寸法不一致拒否。
- export-core build、dependency boundaries、lint、型検査、全テスト／build／RC gateを確認する。

## Next

- merge後はP4-F。3 mode固定作品でPNG／JPEG／PDF／Project JSON、保存再読込、順序、寸法、文字、owner境界、成人向けCloud拒否を受入検証する。
