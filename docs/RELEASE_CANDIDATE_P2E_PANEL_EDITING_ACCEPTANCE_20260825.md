# P2-E 10コマ編集受入fixture

## 結論

P2-A〜Dで追加したコマ設計・生成snapshot・Asset版履歴が、編集時の非破壊条件を満たすことを、外部Provider不要の固定10コマfixtureで回帰検証できる。

## fixture

- 10コマと意味上の順序1〜10
- 各コマに元Assetと補正版Asset
- 各コマに独立した吹き出しと縦書き文字、font、位置
- 各コマにpanel設計revision 2
- 元生成Jobと修正Job、修正元Asset
- 既存credit記録（新規予約・消費は行わない）

## 受入結果

- セリフ本文だけを変更しても、画像、Job、credit、panel設計revisionは変わらない。
- 1コマだけを元Assetへ差し戻しても、他9コマのCanvas／layerと全panel設計versionは変わらない。
- JSON保存・再読込後もpanel order、layer、font、位置、採用Asset、panel設計revisionが一致する。
- 全10コマの修正Jobからpanel設計revisionと修正元Assetを追跡できる。
- 元Asset、後続Asset、Job、利用者データを削除しない。

## 境界

- fixture／テスト／文書のみ。製品コード、API、DB、migrationは変更しない。
- Production、Provider、Worker、Job、Storage、credit予約・消費を実行しない。
- 実画像品質や外部Providerの視覚評価は対象外。

## 検証

- P2-A〜E集中13/13、Hub 876/876、Canvas 26/26、AI 48/48、Desktop 182/182成功。
- a11y violation 0、migration 70件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- 既知の非差分事項はnpm audit 5件（moderate 1、高4）とmodule boundary warning 2件。RC外部設定／手動E2Eはpending。
- CI／Vercel Preview結果はPR証跡へ同期する。
