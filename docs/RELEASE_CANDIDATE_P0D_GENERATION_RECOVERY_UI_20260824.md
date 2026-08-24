# P0-D 生成回復UI Release Candidate

## 変更

- 生成履歴へ工程、失敗工程、自動再開待ち、コマ単位再試行、最終checkpointを安全な日本語で表示する。
- 生のProvider error、HTTP本文、Prompt、秘密情報は表示しない。
- `CLOUD_GENERATION_RESUMABLE_V2_ENABLED`がstrict trueの場合だけ新列を取得し新UIを表示する。
- Flag OFFでは従来SELECTを維持するため、P0 migration未適用環境にも非回帰である。

## 安全境界

- Feature Flagは既定OFF。Production、Provider、Worker、Job、Storage、credit操作は行わない。
- retry／cancelの動作、API response URL、Canvas保存形式は変更しない。

## 検証

- 集中4/4、deps、lint、全型検査、Hub 848 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 65件、Hub／Desktop build、RC structure、diff check成功。
