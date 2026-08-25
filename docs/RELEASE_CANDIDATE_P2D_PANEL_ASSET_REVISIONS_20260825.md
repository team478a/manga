# P2-D コマAsset版履歴・差し戻し

## 結論

既存Canvasが非破壊で保持している採用・修正Asset layerを、再読込後も利用できるコマ単位の版履歴として表示し、過去版へ明示的に戻せる。

## 実装

- 背景、補正版、legacy画像layerを作成日時順のrevision chainへ一般化。
- source Jobから採用、通常修正、inpainting、outpaintingを分類。
- source Assetと現在使用中の版を追跡。
- 選択コマのInspectorへAsset版履歴と「この版へ戻す」を追加。
- 差し戻しは既存Canvas history／autosaveを通り、保存・再読込後も維持される。

## 非破壊境界

- 元Asset、後続候補、Job、Canvas layerを削除しない。
- 自動判定から差し戻さない。利用者の明示操作だけで実行する。
- 選択コマの背景／補正版系列だけを切り替え、人物・効果layerと他コマを変更しない。
- API、DB、migration、Provider adapterを変更しない。

## 検証

- 集中13/13、Hub 872/872、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 70件成功。
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- 既知の非差分事項はnpm audit 5件（moderate 1、高4）とmodule boundary warning 2件。外部環境確認は未実行。
- CI／Vercel Preview結果はPR証跡へ同期する。

## 次

P2-Eで10コマfixtureを使い、セリフだけの修正、1コマだけの画像修正、保存再読込一致を受入れ検証する。P2-Dのmerge前には開始しない。
