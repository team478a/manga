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

## 安全境界

- `CLOUD_PANEL_IMAGE_GENERATION_ENABLED=true`の場合だけ実行
- Release 5の一般向けProject以外を拒否
- 所有者RLSと明示的owner filterを併用
- 既存moderation、quota、料金予約、Provider停止判定を必ず通す
- 成人向け、実在人物、未成年リスク等は既存moderationで拒否
- PromptをClient response、URL、画面、ログへ返さない
- 本番Provider、Worker、Feature Flagは責任者が明示的に有効化する
