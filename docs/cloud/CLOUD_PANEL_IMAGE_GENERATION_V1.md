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

### 確定した参照送信契約（C2、2026-10-12）

- 送信前のProvider選択結果から上限を確定し、修正元→人物→画風→場所→小物の順で最終bundleを作る。同一Assetは1回送るが、複数人物・用途のroleは保持する。Promptの`input_image`、`input_image_2`等と保存する`referenceAssetIds`はこのbundleから作成する。
- FLUX.2 Pro/Maxは8枚、Klein 9Bは4枚。既存の固定モデル契約を[BFL公式モデル一覧](https://help.bfl.ai/articles/7655484417-what-flux-models-are-available)で照合した。モデル切替で上限が変われば登録時に再検証し、送信adapterは黙ってsliceしない。
- Fillは修正元1枚と既存mask／outpainting変換だけを使用する。別の人物・画風・世界参照の送信は非対応とPromptに明示し、人物参照追跡へ含めない。元画像とmaskのサイズ・所有者検査は維持する。
- 版付き人物参照と品質仕様の参照IDも最終送信Assetだけを追跡する。上限内に主要人物のfront/faceを保持できなければ、既存のblock方針で登録停止、warn方針では不足を記録する。
- WorkerはJobのowner/project/deleted_at条件で読み、DB返却順でなく保存ID順に署名URLを準備する。欠損・重複・空path・署名失敗は部分的な参照で続行しない。
- 既存Jobの入力は再書換えしない。再試行で上限超過・修正元順序不整合がある場合は新規送信前に拒否する。既にProvider Job IDがあるpolling再開は追加submitしない既存契約を維持する。
- 実Builder→署名準備→実adapterのmock HTTP検証は送信契約の保証であり、実生成の同一人物再現・4ページ漫画完成を保証しない。Production／有料生成は別の明示承認が必要。

## 安全境界

### 保存済み画像の配置だけ再試行（C4b、2026-10-12）

- 候補履歴の`placement_failed`かつ`panel_adoption_retryable=true`の完了画像へ専用操作を表示する。APIは`POST /api/creator/generation-jobs/[jobId]/retry-placement`、bodyは`{pageId}`だけ。生成条件・Canvas・Asset IDを利用者入力で指定しない。
- 認証済みCreator/Adminであっても本人所有Project／本人作成Job／指定Pageが一致する場合だけ扱う。画像completedと保存済みAssetを確認し、不採用記録・再試行不可・未知状態は配置しない。auto_placedの再要求はno-op、review_requiredは手動確認を維持する。
- 既存Assetと`save_cloud_generation_panel_adoption_v2`を使用する。DBのJob/Page lock、already_applied、source revision／自動配置revision chain、Asset所属／削除チェックを維持し、新規Job／Provider呼出し／credit・monitor AI要求消費／Storage uploadはしない。通常の生成retry APIとは分離する。
- 未保存編集、保存中、編集lock未取得、要求中はUI操作不可。競合再読込でも本人権限と不採用を確認する。手動配置・finalized・非自動revision変更は上書きせず手動確認へ送る。成功は保存先の配置状態であり、画面への実反映・品質・原稿完成ではない。
- 同時要求のローカル検証は既存RPCの原子的な冪等契約を模したRepository testであり、実DBの受入れではない。別画面の品質イベントと保存の同時実行を新たに直列化するmigrationは含めない。実ブラウザ・polling・未保存編集保護の追加検証・実表示telemetryはC4の後続単位で扱う。

### 生成・採用・配置・完成の表示（C4a、2026-10-12）

- `completed`／progress 100%は生成結果の保存を意味し、採用・配置・原稿完成の承認ではない。候補カードで生成工程／採用・品質確認／配置を独立表示し、原稿完成は既存の完成条件判定へ委ねる。
- 配置表示は当該Pageの可視Panelと候補Asset IDを照合する。分離Layerがあれば可視・不透明な実Assetを確認し、legacy Panel画像で隠れたLayerの欠落を補った扱いにしない。未保存Canvasの配置と保存済みCanvasの配置を区別する。
- `auto_placed`のDB記録があってもローカルCanvasに見えなければ「保存先は配置済み・この画面では表示未確認」とする。画像・人物の品質や実pixelの表示をこの表示だけで保証しない。
- 欠落Noticeは当該Pageの可視で画像のないPanelへ限定する。進行中・利用可能な生成済み候補がある同一Panelの過去失敗は再生成誘導に使わず、不採用候補は利用可能件数へ含めない。
- 生成後の再読込で必ず配置される説明をしない。配置失敗は追加生成なしの配置確認、再生成は別の費用承認操作である。今回の変更は表示だけであり、配置retry API／冪等性／pollingと未保存編集保護／実ブラウザ確認は後続のC4変更単位で扱う。
- API、DB、Worker、quota、既存の採用・保存処理は変更しない。通常の生成再試行は既存の費用・明示承認境界を維持する。

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
