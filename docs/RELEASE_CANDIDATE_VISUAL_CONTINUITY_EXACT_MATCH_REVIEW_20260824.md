# 見た目の連続性・完全一致候補監査

作成日: 2026-08-24
Branch: `codex/audit-r4-3-visual-continuity`
Base: `6b3e70d`（PR #325 merge commit）

## 結論

既存の一貫性チェックは設定版、参照画像、コマ割当、生成履歴を監査するが、採用画像の見た目は判定しない。今回、決定的に説明可能な最小範囲として、同一ページまたは隣接ページで完全一致する採用画像をread-onlyの目視確認候補として表示する。

## 実装契約

- 現在表示中で`sourceJobId`を持つ生成画像layerだけを対象にする。
- `cloud_assets`から既存のAsset IDとSHA-256をread-only取得する。
- 同一Asset IDの再利用を`duplicate_asset`として検出する。
- Asset IDが異なってもSHA-256が完全一致する組を`duplicate_digest`として検出する。
- 同一ページまたはページ番号差1の組だけを候補にする。
- 候補から双方のページ編集画面へ移動できる。

## 安全境界

- 既存の設定版・参照画像・割当履歴の警告数を変更しない。
- 販売原稿の完成判定へ接続しない。
- 自動不採用、自動再生成、品質記録の自動更新を行わない。
- perceptual similarity、顔認識、人物属性推測、未確定のVisual Judge閾値を導入しない。
- Visual Judge evidenceは、人間の正解ラベルや履歴監査の代替にしない。
- Production、作品、Canvas、DB、migration、RPC、Storage、API、Provider、credit、PNG／PDFを変更しない。

## 検証

- 集中テスト: 6/6成功。
- dependency boundary: error 0、既存warning 2件。
- lint: 成功。
- Hub／Desktop型検査: 成功。
- Hub: 831/831成功。
- Canvas: 26/26成功。
- AI: 48/48成功。
- Desktop: 182/182成功。
- migration: 61件成功。
- Hub build: 成功。
- Desktop build: 成功。
- `git diff --check`: 成功。

## Productionと費用

Productionへの接続、作品・Canvas・DB・Storageへの書込み、Provider実行、credit予約・消費はすべて0件。今回の変更はコード、UIのread-only表示、テスト、文書だけである。

## 次の判断

1. 完全一致候補の表示をPreviewで確認する。
2. Productionのread-only再集計を別途承認するか判断する。
3. Visual Judge evidenceを採用画像へ結び付ける監査は、保存契約と誤検知条件を先に固定してから別PRで行う。
4. Production修復、Pilot生成、credit予約は個別の明示承認後にのみ行う。
