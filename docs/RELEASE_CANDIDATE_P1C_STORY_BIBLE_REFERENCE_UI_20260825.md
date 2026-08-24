# P1-C 作品バイブル・人物参照UI

## 結論

既存の参照画像画面を非破壊で拡張し、人物version、参照role、優先度、確認状態、作品別の参照不足方針、衣装・状態のページ適用範囲を利用者が管理できるようにした。旧参照画像アップロード、既存Asset利用、自由文人物設定、コマ割当は維持する。

## 実装

- 全人物versionを表示し、既存の人物参照Assetを特定versionへ結び付ける。
- front／side／back／face／full body／expression／costume detail、優先度0〜100、draft／approved／rejectedを編集する。
- 主要人物参照不足時の`block / warn`を作品単位で保存する。
- 人物versionへ範囲名、開始・終了ページ、scene key、衣装、状態、優先度を保存する。
- 同じ人物versionのページ範囲重複をtransaction advisory lock付きRPCで拒否する。
- authenticatedはowner RLS readとowner検査付きRPCだけを利用し、直接writeしない。

## 安全境界

新UIはmigration未適用時に停止案内を表示する。Production migration、Feature Flag、Provider、Worker、Job、Storage、credit操作は行っていない。

## 検証

集中6/6、Hub 856 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、68 migrationの静的検査とPostgreSQL 16 roundtrip、deps、lint、全型検査、Hub／Desktop build、RC structure、diff checkに成功した。
