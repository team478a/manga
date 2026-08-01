# MANGA 人物・効果レイヤー白背景透明化 v1

## 目的

一般向けCloud Canvasで個別生成した人物・効果素材から白い背景を自動除去し、背景レイヤーへ自然に重ねられる透明PNGとして保存する。

## 処理範囲

- 人物だけの生成: `outputAlphaMode=remove_white`
- 効果だけの生成: `outputAlphaMode=remove_white`
- 完成コマ、背景、修正生成: `outputAlphaMode=preserve`
- 未指定Job: 後方互換のため`preserve`

## 透明化方式

1. Providerの出力を既存の画像検証・PNG正規化へ通す。
2. RGBを輝度へ変換する。
3. 輝度245以上の白〜ごく薄い灰色を完全透明にする。
4. それより暗い画素は、線・網点の濃度をalphaへ変換した黒画素にする。
5. 透明PNGを再検証してprivate Storageへ保存する。

この方式により、白い縁や薄い背景汚れを抑えつつ、モノクロ線画と網点を背景上へ合成できる。

## 安全性と互換性

- 透明化の有無はServerが生成Jobへ固定し、任意文字列は受け付けない。
- Workerは明示されたJobだけを保存直前に変換する。
- 既存Asset、既存Job、背景、完成コマ、Image-to-Image、Inpainting、Outpaintingは変更しない。
- DB migration、Feature Flag、Provider、価格設定、外部APIは追加しない。
- 画像寸法、20MB上限、PNG実体検査、Storage補償削除、lease確認を維持する。
- 成人向け、Desktop、Stripe、Marketplaceは変更しない。

## 制約

- v1は一般向けモノクロ漫画素材専用で、カラー保持や人物セグメンテーションは行わない。
- 白以外の複雑な背景をProviderが描いた場合、その形状を意味的に切り抜くことはできない。
- 既に保存済みの生成画像は自動変換しない。新規に人物または効果として生成したAssetだけが対象となる。
- 実Providerによる白地精度と細線・網点の見え方は実ブラウザで確認が必要。

## 確認項目

- 人物・効果Jobだけが`remove_white`になる。
- 未指定Jobは`preserve`になる。
- 白画素のalphaが0、黒画素が255になる。
- 中間トーンが濃度に応じたalphaになる。
- Workerが変換後PNGをStorageへ渡す。
- 完成コマ、背景、既存修正経路が変換されない。

## 自動検証結果

- `npm run deps:check`: 成功
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run hub:test`: 350/350成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run desktop:test`: 182/182成功
- `npm run db:migrations:validate`: 34/34成功
- `npm run build`: 成功
- `git diff --check`: 成功
