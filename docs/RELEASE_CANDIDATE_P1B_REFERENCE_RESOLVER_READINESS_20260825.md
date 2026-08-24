# P1-B 人物参照resolver・生成準備方針

## 結論

単一コマ生成と長編batchが共有する生成準備経路へ、人物versionに固定された承認済み参照画像resolverを追加した。作品別方針は`warn / block`、未設定時は`block`である。新経路は`CLOUD_VERSIONED_CHARACTER_REFERENCES_ENABLED=true`の場合だけ利用し、既定OFFでは既存参照選択を維持する。

## 契約

- resolverは現在の人物profile version IDと一致する`approved` bindingだけを採用する。
- 本人性anchorは`front`または`face`。不足時、`block`はJob登録・credit予約前に停止し、`warn`は理由を生成入力へ保存して続行する。
- role優先、管理優先度、Asset IDの順で決定し、人物ごと2枚・全体8枚までに固定する。
- 生成入力へbundle version、resolver version、人物profile/version、Asset、role、readiness警告を保存する。再試行は既存入力を再利用するため再解決しない。
- style／location／propの既存参照、Provider、Prompt、Worker、料金契約は変更しない。

## DBと安全境界

`cloud_project_generation_readiness_policies`とowner限定保存RPCを追加した。authenticatedはowner RLSによるreadだけ、直接writeはservice roleだけである。Production migration適用、Feature Flag有効化、Provider実行、Job登録、Storage変更、credit予約・消費は行っていない。

## 検証

resolver集中3/3、Hub 853 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 67件の静的検査とPostgreSQL 16 roundtrip、deps、lint、全型検査、Hub／Desktop build、RC structure、diff checkに成功した。外部Providerを使うP1-Fは別承認まで開始しない。
