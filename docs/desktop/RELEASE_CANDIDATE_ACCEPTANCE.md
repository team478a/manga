# MANGAI 配布候補版（RC）受入れ手順

## 1. 目的

MANGAI DesktopとMANGAI Hubを配布候補版として判定するため、外部サービスなしで再現できるローカル品質ゲートと、実サービスを使う手動E2Eを分離します。自動検証の成功だけではRC承認とせず、最後に本書の手動項目を実施します。

## 2. 秘密値を表示しないpreflight

```bash
npm run rc:preflight
```

このコマンドは`.env`、`.env.local`、実行環境の順に設定を確認します。値そのもの、URL、パスワード、API keyは出力せず、各項目を`configured`、`missing`、`placeholder`のいずれかで表示します。

- Hub / Supabase
- Stripeテスト環境
- Desktop端末認証の署名秘密値
- Supabase staging DBと`psql`
- Ollama、ComfyUI、書き出し、Hub・Stripeの手動確認項目

外部設定が不足していても通常のpreflightは終了コード0です。配布判定やCIで外部設定の不足も失敗にする場合は次を使用します。

```bash
npm run rc:preflight:strict
```

## 3. ローカル品質ゲート

```bash
npm run rc:validate
```

次を順番に実行し、最初の失敗で停止します。

| 対象     | 検証                                                              |
| -------- | ----------------------------------------------------------------- |
| Desktop  | TypeScript、ESLint、統合テスト、本番renderer build                |
| Hub      | TypeScript、ESLint、決済・認可テスト、Next.js本番build            |
| Supabase | migration manifest、forward / rollback、transaction境界の静的検証 |

Windowsインストーラーはコード署名と配布チャンネルを含むため、この一括ゲートには含めません。RC成果物を作る時は[`WINDOWS_INSTALLER.md`](WINDOWS_INSTALLER.md)と[`AUTO_UPDATE.md`](AUTO_UPDATE.md)に従って別途作成・署名・確認します。

## 4. Desktopローカル受入れ

外部AIを起動しない状態でも、製品版Desktopで次を確認します。

- 新規Project、Episode、複数Pageを作成し、再起動後に再読込できる
- 素材追加、Canvas配置、移動、拡縮、回転、レイヤー順、Undo / Redoが保存される
- 1920px、1440px、1280px幅で左右パネル、右Inspectorオーバーレイ、下部ステータスが操作できる
- 書き出しダイアログと生成DrawerをTab / Shift+Tab / Escapeで操作でき、終了後に元のボタンへフォーカスが戻る
- バックアップ作成と復元で元Projectを上書きせず、新しいProjectとして開ける
- 診断ログが端末内だけに保存され、削除操作が完了する

## 5. Ollama実サービスE2E

1. Ollamaを起動し、使用するモデルを取得します。
2. Desktopの「設定」からOllamaを有効化し、接続先とモデルを保存します。
3. 「AI接続診断」と「接続確認」が成功することを確認します。
4. Creator Chatで現在のProject / Pageコンテキストを付けて送信します。
5. 生成中の停止、再送信、再生成、コピー、Pageメモ保存を確認します。
6. Desktop再起動後も選択モデルと会話履歴を再読込できることを確認します。

生成本文やpromptを診断ログへ保存しないことも確認します。詳細設定は[`AI_CREATOR.md`](AI_CREATOR.md)を参照してください。

## 6. ComfyUI実サービスE2E

1. ComfyUIを起動し、API形式のworkflow JSONと必要なモデルを準備します。
2. Desktopの「設定」からComfyUIを有効化し、「AI接続診断」を実行します。
3. workflowを登録し、prompt、negative prompt、seed、画像寸法のmappingを検証します。
4. 「画像生成」で1件を完了し、生成画像がProject素材へ登録されることを確認します。
5. 2件目を実行中にキャンセルし、ComfyUI側の処理とDesktopの履歴がキャンセル状態になることを確認します。
6. 失敗するworkflowで、秘密値を含まないエラー表示と再実行導線を確認します。

## 7. 複数Page書き出しE2E

表紙あり、画像あり、吹き出し・縦書き・自由テキストを含む3Page以上のProjectを使用します。

1. PDFを開き、Page順、寸法、DPI、画像、文字、表紙を目視確認します。
2. 連番画像ZIPを展開し、欠落、重複、順番、WebP素材の合成を確認します。
3. MANGAI販売パッケージをHubの`/dashboard/import-package`で読み込みます。
4. manifest、PDFまたは画像ZIP、表紙、先頭3Pageのsample、作品情報、販売文の整合性を確認します。
5. 書き出し中のキャンセルと、その後の再実行が成功することを確認します。

## 8. Hub staging・Desktop端末認証E2E

stagingだけを対象に環境変数を設定し、次を実行します。

```bash
npm run rc:preflight:strict
npm run db:staging:preflight
```

次にHubへログインし、販売パッケージから非公開作品と停止中商品を作成します。Desktopの「Hub連携」で端末認証を開始し、Hubで8桁コードを承認します。非公開下書きと停止中商品数を取得できること、DesktopまたはHubで失効後に取得できなくなることを確認します。

DB migrationの適用・rollback手順は[`../hub/DATABASE_MIGRATIONS.md`](../hub/DATABASE_MIGRATIONS.md)、端末認証の詳細は[`HUB_DEVICE_AUTH.md`](HUB_DEVICE_AUTH.md)を参照してください。

## 9. Stripeテスト決済E2E

1. Stripe CLIまたはstaging Webhook endpointへテストイベントを転送します。
2. 公開作品の販売中商品からCheckout Sessionを作成します。
3. Stripeのテストカードで成功し、注文が`paid`となり期限付きダウンロードが成功することを確認します。
4. Checkoutキャンセルで署名付き注文だけがキャンセルされ、改ざんtokenでは更新されないことを確認します。
5. 非同期成功、非同期失敗、Payment Intent失敗、全額返金を送信し、状態が後戻りしないことを確認します。
6. 未払い、別注文metadata、期限切れURLではダウンロードできないことを確認します。

実在カードや本番課金は使用しません。テスト後はWebhook endpoint、テスト注文、ダウンロードURLの有効期限を確認します。

## 10. RC判定記録

| 判定                  | 完了条件                            | 現在                                       |
| --------------------- | ----------------------------------- | ------------------------------------------ |
| ローカル品質ゲート    | `npm run rc:validate`成功           | 2026-07-15成功（Desktop 35/35、Hub 10/10） |
| Desktopローカル受入れ | 第4節を製品版で完了                 | UI-6まで確認済み。複数Page最終確認待ち     |
| Ollama                | 第5節を実サービスで完了             | 外部サービス待ち                           |
| ComfyUI               | 第6節を実サービスで完了             | 外部サービス待ち                           |
| Hub staging           | 読み取り専用preflightと端末認証完了 | 接続設定待ち                               |
| Stripe                | テスト決済・失敗・返金・認可を完了  | 接続設定待ち                               |
| Windows成果物         | 署名済みinstallerと更新metadata確認 | RC用最終作成待ち                           |

すべてが完了し、重大な未解決不具合がない場合だけRC承認とします。未実施項目を自動テスト成功で代替しません。

2026-07-15の`rc:preflight`では、リポジトリ構造は準備完了、外部サービス設定は未設定、手動E2Eは未実施と判定されました。`rc:preflight:strict`が終了コード1となるのは、この状態では意図した結果です。
