# Creator Chat・ローカルAI生成

更新日: 2026-07-12

## 概要

MANGAI Desktopは、AI未設定でも従来のProject・Episode・Page・素材・書き出し機能を利用できます。ローカルAIを使用するときはワークスペース上部の「設定」「Creator Chat」「AI生成」を使用します。

rendererはOllamaやComfyUIへ直接接続しません。すべての通信、ジョブ、ファイル保存はElectron main processで行い、入力はZodで検証します。

## Ollama設定

1. OllamaをPCへ別途インストールして起動します。
2. DesktopでProjectを開き「設定」を選択します。
3. Ollamaを有効にします。
4. 接続URLを確認します。初期値は `http://127.0.0.1:11434` です。
5. 「接続確認」を実行します。
6. 「モデル一覧更新」を実行してモデルを選択します。
7. Temperature、最大出力、タイムアウト、ストリーミングを設定して保存します。

Ollamaが無効な場合、Creator Chatはテスト可能なモックプロバイダーを使用します。Ollama未導入・停止中でもDesktopの既存機能には影響しません。

## Creator Chat

1. Projectを開き、必要なEpisodeとPageを選択します。
2. 「Creator Chat」を開きます。
3. 必要に応じてプロンプトテンプレートを選びます。
4. AIへ渡すProject情報を確認します。
5. 「Project情報を参照」の有効・無効を選択します。
6. メッセージを送信します。`Ctrl+Enter` でも送信できます。

対応操作:

- 新規セッション
- セッション名変更・削除
- ストリーミング表示
- 送信停止
- 応答再生成
- クリップボードへコピー
- AI応答を選択Pageのメモへ保存
- SQLiteへの会話履歴保存と再起動後の復元

送信候補コンテキストはProjectタイトル、説明、ジャンル、対象年齢、読み方向、選択Episode、選択Page、Pageプロンプト、ネガティブプロンプト、メモです。

## プロンプトテンプレート

11種類の初期テンプレートがあります。「設定」のプロンプトテンプレート欄からユーザー独自テンプレートを追加・削除できます。初期テンプレートは保護されます。

## ComfyUI設定

1. ComfyUIをPCへ別途インストールして起動します。
2. 「設定」でComfyUIを有効にします。
3. 接続URLを確認します。初期値は `http://127.0.0.1:8188` です。
4. タイムアウトとポーリング間隔を設定します。
5. 「接続確認」を実行します。

MANGAI DesktopはComfyUI本体やモデルを自動インストールしません。

## ワークフロー登録

1. 「AI生成」を開きます。
2. 「JSON追加」を選択します。
3. ワークフロー名を入力します。
4. 入力マッピングJSONを確認し、ワークフローのノードID・入力名へ変更します。
5. ComfyUI API形式のワークフローJSONを選択します。

入力マッピング例:

```json
{
  "prompt": { "nodeId": "6", "input": "text" },
  "negativePrompt": { "nodeId": "7", "input": "text" },
  "width": { "nodeId": "5", "input": "width" },
  "height": { "nodeId": "5", "input": "height" },
  "seed": { "nodeId": "3", "input": "seed" }
}
```

ノードIDは例であり、アプリの生成処理には固定されません。登録時のマッピングに従って値を差し込みます。JSONは `{Documents}/MANGAI/ai/workflows/` へコピーされます。

## 画像生成と素材登録

1. 登録済みワークフローを選択します。
2. PromptとNegative Promptを入力します。
3. 「画像生成を開始」を選択します。
4. 実行中ジョブは生成履歴に表示されます。
5. 必要に応じてキャンセルできます。
6. 完了画像は自動的にProject素材へ登録されます。

生成ファイル:

```text
{projectRoot}/generated/images/{generationJobId}/
```

素材メタ情報には生成ジョブ、プロバイダー、ワークフロー、Prompt、Negative Prompt、幅、高さ、Seed、生成日時を保存します。画像本体はSQLite BLOBへ保存しません。

## 生成ジョブ

状態:

- `queued`
- `running`
- `completed`
- `failed`
- `canceled`

失敗した画像ジョブは履歴から再実行できます。実行中ジョブはキャンセルできます。アプリ終了時に残った`running`ジョブは、次回起動時に`failed / INTERRUPTED`へ変更されます。

## SQLite追加テーブル

- `ai_provider_settings`
- `ai_models`
- `chat_sessions`
- `chat_messages`
- `prompt_templates`
- `generation_jobs`
- `generation_outputs`
- `comfy_workflows`

`assets`には `generation_job_id` と `metadata_json` を追加しています。

## ログ

AI処理エラーは次へJSON Lines形式で保存します。

```text
{Documents}/MANGAI/logs/ai.log
```

一般画面には日本語メッセージを表示し、スタックトレースは表示しません。秘密鍵やクラウドAPIキーは現在扱っていません。

