# BFL Image Editing原価計測・予約guard

## 背景

P3-Eの実Provider比較で、BFL `flux-2-pro`の参照付きImage Editingは公式最低`$0.045`である一方、現行adapterと価格台帳がText-to-Imageと同じ`$0.030`を使うgapを検出した。

## 修正

- BFL submit応答のoptional `cost`を有限・非負・上限付きで検証する。
- Provider creditを`1 credit = $0.01`としてUSD microsへ変換し、Jobの実原価へ使用する。
- checkpoint再開等でsubmit costを取得できない場合、出力MPと参照有無から原価を安全側に算出する。参照付き`flux-2-pro`は1MPあたり`45,000` micros、最大4MPは`180,000` microsとなる。
- 参照なしText-to-Image、Klein、Max、Fillの既存fallbackは維持する。
- `flux-2-pro`だけを新pricing version `bfl-flux2-pro-2026-08`へ切り替える。
- 4 job typeの最大予約原価を最大4MPの`180,000` microsへ上げる追加migrationと、新versionだけを削除するrollbackを追加する。

通常Text-to-Imageも最大`$0.180`を予約するが、Provider返却costで実額を確定し、差額はsettlementで解放する。過少予約を避けることを優先する。

## 境界

- 既存migrationと旧pricing rowを変更・削除しない。
- 内部credit数`2`、Provider、model、Prompt、moderation、retry、timeout、Job状態、Storageを変更しない。
- Production／stagingへmigrationを適用しない。
- Provider実行、Job登録、credit予約／消費を行わない。
- API key、Provider response本文、Promptをログへ追加しない。

## 検証

- 集中16/16
- Hub 886/886、Canvas 26/26、AI 48/48、Desktop 182/182
- a11y violation 0、migration 72件
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
- npm audit既知5件、module boundary既知警告2件、外部設定／手動E2E pendingは既存状態

## 次

本PRのmerge後、責任者承認のあるstagingへmigrationを適用し、参照付き1 Jobで最大予約`$0.180`、Provider返却cost、settlement、差額解放を確認する。Production適用は別承認とする。
