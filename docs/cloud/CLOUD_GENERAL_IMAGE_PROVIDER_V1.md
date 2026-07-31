# 一般向けクラウド画像生成 Provider v1

## 目的

Release 6の「コマを選択して画像生成する」導線を、一般向け作品に限定して
Black Forest Labs（BFL）のFLUX.2 APIへ接続する。

利用者はProvider、モデル、APIキー、解像度、技術的なPromptを意識しない。
管理者が`/admin/cloud-ai`で接続を保存すると、既存のQueue、利用枠、
原価予約、Worker、画像検査、Storage保存、コマ配置をそのまま利用する。

## 採用モデル

- `flux-2-pro`: 標準。品質と原価のバランスを優先
- `flux-2-klein-9b`: 低コストの試行・大量生成向け
- `flux-2-max`: 高品質が必要な最終候補向け

Preview endpointは自動更新で出力が変化するため採用せず、再現性のある固定版を
利用する。料金versionは`bfl-flux2-2026-03`として固定し、変更時は新しい
pricing versionを追加してから切り替える。

確認元:

- https://docs.bfl.ai/quick_start/pricing
- https://docs.bfl.ai/flux_2/flux2_overview
- https://docs.bfl.ai/api_integration/integration_guidelines

## 秘密情報

- BFL APIキーは管理画面のpassword入力からSupabase Vaultへ保存する
- 通常テーブルにはVault secret IDだけを保持する
- APIキー本体や末尾文字を画面、Client response、ログ、監査ログへ出さない
- 復号RPCは`service_role`だけが実行できる
- キーを空欄にした保存では既存キーを保持し、交換時だけ新しいキーを入力する

## 実行経路

1. 利用者が一般向けCanvasで対象コマを選択
2. Serverが採用ネームからPromptと縦横比を組み立てる
3. 一般向けモデレーション、所有者確認、quota、rate limit、原価予約を行う
4. WorkerがVaultの有効なBFL設定を取得
5. BFLへ`safety_tolerance=1`で送信し、返却された`polling_url`を利用する
6. Ready後の署名URLから直ちに画像を取得する
7. 画像検査・メタデータ除去後にprivate Storageへ保存
8. 利用者が生成結果を選択コマへ配置する

## Fail closed

以下では新しい画像Jobを開始しない。

- migration未適用
- APIキー未設定
- Provider設定が停止
- 全体Cloud AI kill switchが停止
- 有効なProvider価格がない
- Release 6 Feature Flagが停止
- 一般向け以外のProjectまたは成人向け表現を含むPrompt

文章生成、編集、保存、書き出しは画像Provider停止中も継続できる。

## 初回設定

1. `202607310004_cloud_general_image_provider.sql`をstagingへ適用
2. `/admin/cloud-ai`でBFL APIキー、モデル、接続状態「有効」を保存
3. Cloud AI全体設定、Release 6 Flag、Workerを確認
4. 一般向けテスト作品で1コマだけ生成
5. 原価台帳、Job、画像検査、コマ配置を確認

成人向け画像生成はこのProviderの対象外であり、将来の独立GPU/VPS APIまで
停止状態を維持する。

`/admin/general-monitors/readiness`では、APIキー本体を表示せずに次を確認する。

- 一般向け画像生成AIが設定済みかつ有効
- `MANGAI_CLOUD_AI_WORKER_ENABLED=true`
- `MANGAI_CLOUD_AI_WORKER_SECRET`が32文字以上

Workerが停止している場合、画像JobはQueueに登録されても完了しないため、
モニター招待前の必須条件として扱う。
