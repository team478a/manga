# PR-R4-2N Provider moderation安全な構図契約

## 判定

- Branch: `codex/fix-r4-2n-provider-moderation-safe-framing`
- Base: `ff5ea38e80d44acf7a379f1b01b75de5d748a1ba`（PR #270 merge commit）
- 状態: `IN_PROGRESS`
- 対象: R4-2MのProvider JSON構図とProvider拒否後の安全再実行
- Production変更: 限定受入れの失敗2 Jobのみ。Asset・実費・作品変更なし

## PR #270反映後の限定受入れ

Productionの`test`モニターでページ22・4コマ目の候補を1案だけ再制作した。

| 項目 | 初回 | 一般向け安全再実行 |
|---|---|---|
| Job | `8bf051c1-3f08-4ec9-8a63-f3a553d30f14` | `d5eaed83-1c10-45a0-94ec-bcda1b7ac219` |
| Worker | `31866069529` | `31866237664` |
| Worker結果 | `status=idle requests=2 processed=1` | `status=idle requests=2 processed=1` |
| Job結果 | `provider_moderation_blocked` | `provider_moderation_blocked` |
| Asset | なし | なし |
| actual cost | 0 | 0 |

各試行でcreditは使用44、予約0→2→0、残り56→54→56へ全額復元した。最終は使用44／予約0／残り56。重複Jobと継続Workerはなく、画像配置、品質承認、Canvas revision、作品内容、公開・販売状態を変更していない。

## 根因

同じコマ、同じ参照画像、同じProvider／modelで、R4-2L時点のPromptは画像生成を完了している。R4-2Mの差分でProvider JSON先頭へ次の身体部位列挙を重複追加した。

`complete hair silhouette, both eyes, nose, mouth, chin, neck, and shoulder tops`

この列挙は後段の日英フレーミング契約と重複し、Provider moderationが最優先JSONを身体部位の直接列挙として解釈する余地を作った。既存の一般向け安全再実行は動作、感情、演出を安全化するが、Provider JSONを変更しないため同じ列挙が残り、2回目も拒否された。

BFLが公式に対応する構造化Promptと、R4-2Mで追加した入力画像別役割は維持する。今回の修正は、Production差分で新たに加わった重複語彙だけを対象とする。

## 実装

新しく生成するclose-upのProvider JSON構図を次へ変更する。

`uncropped medium close-up head-and-shoulders portrait; subject fully contained within the frame with a clear 10% composition margin`

- uncropped、medium close-up、head-and-shoulders、10% marginを維持する。
- JSON最優先契約から目、鼻、口、顎、首の列挙を除く。
- 後段の日英フレーミング契約は変更しない。
- 参照画像の役割、送信順、Panel Specificationを変更しない。

Provider拒否後の一般向け安全再実行は、`PROVIDER CONTROL CONTRACT:`直後のJSONだけを安全にparseする。旧身体部位列挙を含む`composition`だけを上記表現へ差し替え、カメラ角度、出力形式、無記名面など他のfieldを保存する。JSONでない旧Promptは従来どおり変更しない。

## 回帰テスト

- 新規close-up PromptのProvider JSONが非crop頭肩構図と10% marginを保持する。
- Provider JSONに旧身体部位列挙を含まない。
- 後段の日英フレーミング契約を維持する。
- Provider拒否後の安全再実行が保存済み旧JSONだけを変換する。
- JSON内のcamera angleなど他field、人物設定、参照Asset、negative promptを維持する。
- 文章JobとJSONなしの旧Promptを変更しない。

## 検証結果

| Gate | 結果 |
|---|---|
| 集中テスト | 30/30 成功 |
| Hub test | 成功 |
| Canvas test | 26/26 成功 |
| AI test | 48/48 成功 |
| 100ページ長編 | 4/4 成功 |
| Dependency boundaries | 成功（既存warning 2件、error 0） |
| Lint | 成功 |
| Hub typecheck | 成功 |
| Migration validate | 59/59 成功 |
| Research eval | 成功 |
| Cloud漫画repository受入れ | 成功 |
| Owner isolation | 成功 |
| Workspace package build | 成功 |
| Next.js Webpack production build | 成功 |
| RC structure preflight | 成功（外部設定・手動E2Eは既存どおりpending） |

## 外部契約と停止条件

URL、公開API、DB、migration、RPC、Storage、Feature Flag、Provider、model、pricing、credit単価、retry回数、timeout、Scheduler、Canvas schema、checkpoint、PNG／PDF、成人向け境界、Desktopを変更しない。

R4-2N実装後のProduction Provider E2E、画像配置、品質承認、作品変更は行わない。Draft PR、Core quality、Migration roundtrip、Windows build、Vercel、Vercel Preview Commentsが成功した時点で停止する。merge前にProductionで追加生成しない。
