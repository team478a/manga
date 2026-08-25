# P4-A 完成モードprofile契約

## 結論

用途別完成モードをProvider、DB、UI、exportから独立した純粋schemaとして`@mangai/shared`へ追加する。現時点では公式preset値を定義せず、呼び出し側が渡した値だけを検証する。

## 契約

- version: `1`
- mode: `longform_story | kindle_explainer | adult_local`
- execution surface: `cloud_general | desktop_local`
- page preset: width、height、dpi、`rtl | ltr`
- guidance: 1ページの推奨コマ数範囲、1コマの最大セリフgrapheme数
- required checks: manuscript preflight、quality findings、content boundary
- allowed exports: PNG、JPEG、PDF、Project JSON

## 安全境界

- `adult_local`は`desktop_local`以外をschemaで拒否する。
- `content_boundary`検査を省略できない。
- 重複した検査／出力、逆転したコマ数、範囲外寸法を拒否する。
- modeがnull／undefinedの既存Projectは`null`へ解決し、従来動作を維持する。
- profile解決はProject、Canvas、Asset、Job、creditを変更しない。

## 数値preset

テスト値はschema境界を確認するfixtureであり、製品の推奨値ではない。長編／Kindle／成人向けの公式preset値は責任者承認後のP4-Bで別途定義する。

## 不変

DB、migration、API、UI、既存Project型、export、Storage、Provider、Worker、Job、credit、Production／stagingを変更しない。

## 次

全ローカルゲート、Draft PR、全CI／Vercel Preview成功で停止する。merge後は承認済みpresetとProject選択UIを扱うP4-Bへ進む。

## 検証

- 集中8/8
- Hub 893/893、Canvas 26/26、AI 48/48、Desktop 182/182
- a11y violation 0、migration 72件
- deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功
