# Cloud Panel Image Generation v1

## 利用者体験

1. Release 5で作成したCanvasを開く
2. 画像を付けたいコマを選ぶ
3. 「選択したコマを生成」を押す
4. 完了後に「このコマへ配置」を押す

利用者はPrompt、モデル名、Provider、解像度を入力しない。

## Server側入力

- 所有者本人のRelease 5 Project
- Projectに紐づく採用ネーム
- 現在Pageの番号
- 選択したCanvas panel ID
- ネーム上の同一ページ・同一順序のコマ情報

## 生成条件

- 一般向け漫画の1コマ
- 画角、カメラ、構図、人物、背景、動作、感情、演出指示
- 吹き出し・セリフ・文字はCanvas側で重ねるため画像へ描かない
- 選択コマの縦横比から256〜1536pxの範囲で解像度を決定
- `background` Jobとして既存Cloud AI Queueへ登録

### 確定した場面契約（C1、2026-10-12）

- `storyboard`選択値は元ネームの実画角・カメラへ解決し、明示overrideを優先する。通常版・短縮版のProvider契約は同じ確定人数、画角、カメラ、配置、視線、追加指示、動作、表情、背景を使用する。
- 人物設定は名前ごとに分離し、profile ID/version、年齢、体格、髪、衣装、配色、不変特徴、追加指定を保持する。複数人物を単一subjectへまとめない。人物なし／背景・効果ではsubject配列を空にする。
- クローズアップでも全員の顔が読めるフレーミングを要求するが、中央固定や「人物1人」「画面高58%」で元の構図・人数を上書きしない。必要な端末・小物の動作を削除せず、無記名の面と単一小物の描画契約を併記する。
- 台詞混入の既存浄化と一般向けmoderationは維持する。短縮は冗長な説明の削減に限定し、必須設定を文字数で切り捨てない。Prompt全体が20,000文字を超えればProvider登録前に入力エラーとする。
- 既存Jobを再書換えせず、新規登録時の既存保存経路を使用する。DB、API、Storage、料金・承認契約は変更しない。参照画像の最終送信順序・モデル上限の整合（C2）は別の変更単位。
- 実Builderの0〜3人×3画角、配置・視線、override、長文予算、通常／短縮契約一致の回帰テストはコード保証であり、生成画像の人物同一性・作画品質や4ページ原稿完成を保証しない。

## 安全境界

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`の場合だけ実行
- Release 5の一般向けProject以外を拒否
- 所有者RLSと明示的owner filterを併用
- 既存moderation、quota、料金予約、Provider停止判定を必ず通す
- 成人向け、実在人物、未成年リスク等は既存moderationで拒否
- PromptをClient response、URL、画面、ログへ返さない
- 本番Provider、Worker、Feature Flagは責任者が明示的に有効化する

## 一般向け本番Provider

- BFL FLUX.2の固定版を`/admin/cloud-ai`から設定する
- APIキーはSupabase Vaultだけへ保存し、Vercel環境変数へ複製しない
- 接続仕様と初回設定は
  [CLOUD_GENERAL_IMAGE_PROVIDER_V1.md](CLOUD_GENERAL_IMAGE_PROVIDER_V1.md)
  を正本とする
- 成人向け画像生成は対象外とし、同じAPIキー・Queueへ送信しない
