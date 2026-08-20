# RELEASE CANDIDATE: 表示Assetの品質承認と完成判定

作成日: 2026-08-20

基準: PR #318 merge commit `f9316ea2b41c2ec97a20aef6f6fcd32bdbcf3864`

Branch: `codex/fix-r4-3-visible-asset-quality-completion`

## Production受入れ

PR #318のmerge commitがVercel Productionへ反映済みであることを確認し、`test`の既存22ページを再読込した。

- 画像: 4/4
- セリフ: 1/1（`auto_placed`）
- 生成中: 0
- 失敗: 0
- Canvas revision: 保存済み11／現在11
- PNG: 成功
- credit: 使用80、予約0、残り20
- 完成表示: 編集画面だけ「手動確認待ち」
- blocker表示: 「自動配置結果に確認が必要です。」のみ

Production作品、Canvas、DB、Storage、品質記録への書込み、Provider実行、生成、credit消費は行っていない。

## 原因

PR #318でAsset IDによる品質承認照合を利用したが、次の2点が欠けていた。

1. 表示layerに`assetId`があっても`sourceJobId`がなければ、Asset承認済みコマとして収集しなかった。
2. 表示Assetを生成したJobが同じコマの最新Jobでない場合、そのJob IDを`cloud_manga_quality_logs`の取得対象へ含めなかった。

そのため、品質承認済みAssetが現在原稿に表示されていても、別生成単位に残る古いadoption確認待ちを解決できなかった。

## 修正契約

- Canvasで現在表示中のAsset IDを収集する。
- 取得済み画像Jobから、その表示Assetを出力したJob IDを特定する。
- current Job、表示layerのsource Job、表示Assetの生成元Jobを品質ログ取得対象へ含める。
- Job IDまたはAsset IDで品質承認済みの表示画像をコマ単位で認識する。
- `sourceJobId`を持たないlayerとlegacy `panel.imageAssetId`もAsset承認経路で扱う。
- 非表示layer、未承認Asset、表示対象でないlegacy Assetは扱わない。

## 維持するguard

- 表示中の未承認生成画像
- 不採用生成画像
- 利用不能Asset
- 画像または必須セリフ不足
- Canvas snapshot revision不一致
- PNG書き出し失敗
- 制作状態の要確認・要修正
- 品質承認済みの表示画像がないコマの未解決adoption確認待ち

## 回帰テスト

- `sourceJobId=null`でも表示Assetが品質承認済みなら対象コマを認識する。
- 同じAssetが未承認なら認識しない。
- layerが非表示なら認識しない。
- separated layerがなくlegacy `panel.imageAssetId`だけの場合も、表示Assetの品質承認を認識する。
- PR #317／#318の候補単位、不採用、兄弟候補、表示Job承認の境界を維持する。

## 変更しない契約

API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。

## ローカル検証

- 集中テスト: 17/17
- dependency boundary: error 0（既存warning 2件）
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub: 826/826
- Canvas: 26/26
- AI: 48/48
- Desktop: 182/182
- Desktop accessibility: exit 0、violation 0
- migration validation: 61件
- Hub build: 成功
- Desktop build: 成功
- RC preflight: Repository structure READY
- RC外部設定: ローカルに秘密情報を置かない既存方針のためPENDING

## merge後の受入れ

追加Provider実行・追加課金なしで対象22ページを再読込し、次を確認する。

1. 編集画面が「ページ完成」になる。
2. 画像4/4、セリフ1/1、生成中0、失敗0を維持する。
3. Canvas revision 11を維持する。
4. PNGが成功する。
5. credit使用80・予約0・残り20を維持する。

Production DB、作品、Canvas、画像、品質記録を手動更新して判定を合わせてはならない。
