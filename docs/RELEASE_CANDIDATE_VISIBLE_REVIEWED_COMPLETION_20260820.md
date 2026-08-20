# RELEASE CANDIDATE: 表示中の品質承認済み画像と完成判定

作成日: 2026-08-20  
基準: PR #317 merge commit `0538c4f4f3b4668f963220af3f45fd7f22e5ce83`  
Branch: `codex/fix-r4-3-visible-reviewed-completion`

## Production受入れ

PR #317のmerge commitがVercel Productionへ反映済みであることを確認し、`test`の既存22ページを再読込した。

- 画像: 4/4
- セリフ: 1/1（構造化セリフは`auto_placed`）
- 生成中: 0
- 失敗: 0
- Canvas revision: 保存済み11／現在11
- PNG: 成功
- credit: 使用80、予約0、残り20（受入れ前後で変化なし）
- ブラウザログ: 0件
- 完成表示: 編集画面だけ「手動確認待ち」

長編制作状態の「確認が必要」filterに22ページは含まれなかった。したがってdialogue placementと`cloud_pages.production_status`ではなく、panel adoption判定が残存原因である。

Productionへの書込み、Provider実行、生成、credit消費、作品・Canvas・DB・Storage変更は行っていない。

## 原因

PR #317は、同じ候補生成単位の中に品質承認済み候補がある場合に古いadoption確認待ちを解決した。しかし現在Canvasに表示中の画像が別Job／Asset経路で品質承認され、同じコマに別生成単位の古い`review_required`／`placement_failed`が残る場合は解決できなかった。

完成判定は表示中の生成layerについて、Job IDまたはAsset IDによる品質承認を既に必須確認している。非表示の古い候補台帳だけが、品質承認済みの現在原稿を手動確認待ちへ戻していた。

## 修正契約

現在Canvasで次の全条件を満たすlayerを、品質承認済みの表示画像としてコマ単位で収集する。

- 表示中
- panel IDあり
- source Job IDあり
- Job IDまたはAsset IDに品質承認記録あり

該当コマでは、別生成単位に残る非表示の古いadoption確認待ちを完成阻害にしない。

以下は従来どおり完成を阻害する。

- 表示中画像自身が未承認または不採用
- 画像Assetが利用不能
- 必須画像またはセリフが不足
- Canvas snapshot revision不一致
- PNG書き出し失敗
- 制作状態が要確認・要修正
- 表示中画像がないコマの未解決adoption確認待ち

## 回帰テスト

純粋domain helperで以下を固定した。

- 表示中の品質承認済み画像あり: 別生成単位の古い`review_required`を解決済みとする
- 表示中の品質承認済み画像なし: 同じ状態を未解決のまま保持する
- PR #317で追加した同一候補生成単位、不採用、兄弟候補、全候補不採用の境界を維持する

## 変更境界

変更は完成判定のapplication/domainと回帰テスト、証跡文書のみ。API、URL、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PNG／PDF処理、成人向け境界、Desktop製品コードを変更しない。

## ローカル検証

- 集中テスト: 16/16
- dependency boundary: error 0（既存warning 2件）
- lint: 成功
- Hub／Desktop typecheck: 成功
- Hub: 825/825
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

1. 編集画面が「ページ完成」になる
2. 画像4/4、セリフ1/1、生成中0、失敗0を維持する
3. Canvas revision 11を維持する
4. PNGが成功する
5. credit使用80・予約0・残り20を維持する
6. ブラウザログ0件

Production DB、作品、Canvas、画像、品質記録を手動更新して判定を合わせてはならない。
