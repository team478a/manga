# Manga quality benchmark fixtures

R4-3A の品質判定を再現可能に評価するための、非公開・ローカル専用 fixture です。
画像本体は `assets/` に置き、Git にはコミットしません。`manifest.json` には画像の相対パス、SHA-256、MIME type、寸法、Panel Specification、正解ラベルだけを登録します。

## 受入れ条件

- 総数 30〜50 件
- 採用可能画像 15 件以上
- 次の不良群を各 5 件以上
  - キャラクター／顔の不一致
  - 人体破綻／手／人物と小物の融合
  - 文字／UI artifact
  - 構図／crop
  - 向き／重力
  - 背景／小物

不足は `unknown` や中立点で補完せず、`BLOCKED_FIXTURE_SHORTAGE` として扱います。

## 追加時の注意

1. 利用権を確認し、第三者の個人情報、API key、署名付きURL、Productionの非公開作品を含めない。
2. 成人向け画像を混在させない。必要になった場合は既存の成人向け境界とは別の承認を得る。
3. `assets/` の画像名から利用者名や作品名を推測できないようにする。
4. `npm run manga:quality:benchmark:preflight` で形式・hash・寸法・不足数を確認する。
5. fixtureが揃った後だけ `npm run manga:quality:benchmark:strict` を合格条件として使う。

このfixtureはProduction DB、Storage、既存作品とは接続しません。
