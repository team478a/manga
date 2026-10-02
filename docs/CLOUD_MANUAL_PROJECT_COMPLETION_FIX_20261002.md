# Cloud手動作品の完成判定修正（2026-10-02）

## 目的

Providerを実行せず、利用者が手動作成したCloud作品または一般向けDesktopからimportした作品を、保存済み画像とCanvasだけで完成判定できるようにする。

## 原因

ページ完成判定は、AIネームから作成した作品の必須セリフを確認するため`cloud_story_storyboard_projects`を参照していた。手動作品とDesktop import作品にはこの対応行がないため、正常な「Storyboardなし」を読込失敗と同一扱いにし、ページ確定を停止していた。

## 修正

- Storyboard対応行がない場合は、必須セリフ0件の手動作品として完成判定を続行する。
- DB照会エラーは従来どおりfail closedとし、完成扱いにしない。
- Storyboard対応行がある作品は、従来どおり採用Storyboardのセリフを照合する。
- 画像、Canvas保存revision、PNG描画、手動確認、ページ制作状態、完成版checkpointの既存条件は変更しない。

## Production E2E境界

責任者承認後、`test`アカウントで既存画像を再利用した非公開2ページ作品を作り、全ページ確定、完成版checkpoint、PDF、paused商品まで準備する。作品公開、商品販売開始、Checkout、決済、Provider実行、credit予約・消費は行わない。

Production操作は本修正のmerge・Production反映後に、利用者本人の正規UIで実施する。DBへの直接投入や既存32ページ作品の状態変更は行わない。
