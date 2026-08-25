# P4-B 完成モードpreset・新規Project選択

## 結果

- `longform_story`、`kindle_explainer`、`adult_local` のversion 1 presetを共有契約から決定論的に解決する。
- Cloud新規作品では一般向け2モードだけを選択でき、寸法、DPI、推奨コマ数、セリフ量を送信前にpreviewする。
- 作成時にprofile全文を`cloud_projects.completion_mode_profile`と初期version manifestへ保存する。
- 既存Projectはnullのままとし、寸法やmetadataを推測・更新しない。
- `adult_local`は共有presetのみ。Cloud選択・Cloud保存をDBでも拒否し、Desktop local-only境界を維持する。

## preset根拠と境界

| mode | page preset | MANGAI guidance | export候補 |
| --- | --- | --- | --- |
| 長編 | 1600×2400px / 300 DPI / 右綴じ | 1〜8コマ、1コマ200文字まで | PNG、JPEG、PDF、Project JSON |
| Kindle解説 | 2400×3840px / 300 DPI / 右綴じ | 1〜6コマ、1コマ120文字まで | JPEG、PDF、Project JSON |
| 成人向けlocal | 1600×2400px / 300 DPI / 右綴じ | 1〜8コマ、1コマ200文字まで | PNG、JPEG、PDF、Project JSON |

長編・成人向けは既存MANGAI既定値を維持する。KindleはKDP固定レイアウトの推奨2倍画像3840×2400を単ページ縦向きへ転置した2400×3840とし、300 DPIを維持する。これはMANGAIの素材presetであり、KDPへの直接納品保証ではない。最終成果物はKindle Create等でKPF/EPUBへ変換して検証する。推奨コマ数とセリフ量はKDP要件ではなくMANGAIの編集guidanceである。

公式根拠:

- https://kdp.amazon.com/en_US/help/topic/G9GSTY4LTRT39D4Z
- https://kdp.amazon.com/en_US/help/topic/GJMRD9F78MS9F43R
- https://kdp.amazon.com/en_US/help/topic/GULSQMHU5MNH4EZM

## 非実施

- migrationのProduction／staging適用
- 既存Projectのbackfill・寸法変更
- Provider、Worker、生成Job、credit、Storage操作
- JPEG／Project JSONの書き出し実装（後続P4-C以降）

## 検証

- preset集中テスト 5/5
- Hub、Canvas、AI、Desktop、Desktop a11y 全成功
- migration 73件とrollback整合性成功
- dependency／module／code-size、lint、Hub／Desktop型検査成功
- Hub／Desktop production build、RC repository structure、`git diff --check`成功
