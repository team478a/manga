# P4-C mode別preflight

## 結果

- profile設定済みProjectでは、各ページの可視コマ数と各テキストのgrapheme数をmode guidanceと比較する。
- guidance逸脱は`warning`であり、単独では書き出しを停止しない。
- P3品質findingをowner RLS配下でread-only取得し、最新のpage／panel／category単位だけを判定する。
- `FAIL`は`error`、`WARNING`と`NOT_EVALUATED`は`warning`、`PASS`は問題なしとして扱う。
- 品質finding table未適用時は手動確認warningへfail closedする。
- mode未設定の既存Projectはprofileを推測せず、従来preflightを維持する。

## 維持した既存error

- 表紙欠落、ページ順不整合
- 空コマ、Asset欠落
- 文字overflow、不自然な縦書き分割
- 未確定／staleページ、実行中生成

## 非実施

- 自動修正、自動採否、自動再生成、Job作成
- finding更新／削除、元Asset削除
- migration、Production／staging変更
- Provider、Worker、credit、Storage操作

## 検証

- 集中テスト10/10
- Hub全件、Canvas 26/26、AI 48/48、Desktop 182/182、Desktop a11y violation 0
- migration 73件、dependency／module／code-size、lint、全型検査成功
- Hub／Desktop production build、RC repository structure、`git diff --check`成功
