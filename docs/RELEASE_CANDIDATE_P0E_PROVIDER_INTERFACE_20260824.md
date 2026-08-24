# P0-E Provider interface Release Candidate

- 共通画像Providerへoptional `capabilities`、`generatePanel`、`editRegion`、`estimateCost`、`cancelProviderJob`を追加した。
- 既存`generate`／`cancel`は維持し、Mock／Gateway／BFL adapterは既存`generate`へ委譲する。
- Worker、Provider選択、model、request、費用、retry、Feature Flagは変更しない。新Providerは追加しない。
- 集中2/2、deps、lint、全型検査、Hub 850 tests、Canvas 26/26、AI 48/48、Desktop 182/182、a11y violation 0、migration 65件、両build、RC structure、diff check成功。
- Production、Provider実行、Job、Storage、credit操作0件。
