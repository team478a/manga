# P2-C コマ設計生成入力snapshot

## 結論

保存済みのコマ意味設計を生成時点のrevision付きsnapshotとして単一／batch生成Job入力へ固定できる。Feature Flagは既定OFFで、既存生成経路を維持する。

## 実装

- AI Coreにversion付きpanel design schemaと生成入力snapshotを追加。
- 単一とbatchが共有する準備点でowner／project／page／panel一致の現在設計を取得。
- 場面、人物の動作・表情・ポーズ・視線・位置、camera、小物、連続状態をPrompt compilerへ反映。
- negative条件は既存negative Promptへ追記。
- Job provenanceと履歴UIには使用revisionだけを表示し、Promptや設計本文は表示しない。

## Feature Flag

`CLOUD_PANEL_DESIGN_GENERATION_ENABLED`はstrict判定で既定OFF。OFFまたは設計未作成の場合、従来Prompt入力を維持する。Flag有効化、Production設定変更は今回行わない。

## 境界

- Canvas、Storyboard、既存panel specification、Provider adapterを置換しない。
- migration、Production、Provider／Worker実行、Job作成、Storage、credit操作なし。
- 特定Provider／model情報をpanel designへ追加しない。

## 検証

- 集中12/12、Hub 870/870、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0。
- migration 70件、deps、lint、全型検査、Hub／Desktop build、RC structure、diff check成功。
- `npm audit`の5件とmodule warning 2件は既存・差分外。CI結果はPR証跡へ同期する。

## 次

P2-Dで採用Asset／候補／部分修正のrevision chainと永続差し戻しを追加する。P2-Cのmerge前には開始しない。
