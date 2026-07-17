# Dezgo Phase 1 実API手動E2E

## 1. 目的と状態

非成人向けText-to-Imageを10件だけ実行し、明示承認、直列Queue、画像保存、費用台帳、失敗隔離を実環境で確認します。

この文書は手順書です。現時点の状態は**未実施**であり、Codexの自動検証はDezgo実APIを呼び出していません。

## 2. 絶対条件

- ユーザー本人が実API送信と費用発生を明示承認してから開始する
- 成人向け、人物、キャラクター参照、完成Page、入力画像を使用しない
- APIキーを環境変数、コマンド、スクリーンショット、報告書、Gitへ記録しない
- APIキーはMANGAI設定画面からWindows資格情報マネージャーへ保存する
- Prompt本文と生成画像を試験報告へ添付しない
- Project月間上限を設定し、10件を超えて実行しない
- 予想外の費用、外部送信確認の省略、秘密値露出、成人向け送信が1件でも発生したら直ちに停止する

## 3. 事前準備

1. 専用の非成人向け試験Projectを作成します。タイトルにもAPIキーやPromptを含めません。
2. Project外部処理ポリシーを`safe_assets_only`、毎回確認あり、ローカル優先にします。
3. 月間費用上限は、10件の承認上限合計を確認したうえで必要最小限に設定します。
4. 自動検証を実行します。

```powershell
npm run ai:test
npm run desktop:test
npm --prefix apps/desktop run typecheck
npm --prefix apps/desktop run lint
```

Desktop統合テストには、同じdispatcherを並行起動しても1回だけ送信する検証と、実Provider形式の認証headerを使った後もテスト用秘密値がSQLite、WAL、ログ、生成物へ残らない検証が含まれます。ここが失敗した場合は実API試験へ進みません。

5. APIキーをコマンドラインへ入力せず、次の開発限定フラグだけを設定してDesktopを起動します。

```powershell
$env:MANGAI_ENABLE_DEZGO_PROVIDER="true"
$env:MANGAI_ENABLE_DEZGO_DIRECT_BYOK="true"
$env:MANGAI_ENABLE_DEZGO_DISPATCH="true"
npm run desktop:dev
```

6. 設定画面で`生成dispatcher: 開発限定で有効`を確認します。
7. 設定画面からAPIキーを保存し、接続・残高確認を1回だけ実行します。
8. モデル一覧から`text_to_image`対応モデルを1つ選び、そのモデルIDだけを結果表へ記録します。

## 4. 10件の試験表

各試験のPromptは「人物を含まない背景または小物」に限定します。本文は結果表へ転記せず、`prompt_sha256`だけが端末内監査情報へ残ることを確認します。

| ID | 種類 | 要求寸法 | Steps | Seed方針 | 確認項目 |
| --- | --- | ---: | ---: | --- | --- |
| D01 | background | 512×512 | 30 | 固定 | 基本成功・Asset登録 |
| D02 | background | 512×768 | 30 | 固定 | 縦長画像・寸法 |
| D03 | background | 768×512 | 30 | 固定 | 横長画像・寸法 |
| D04 | background | 768×768 | 30 | 固定 | 費用header・残高 |
| D05 | background | 1024×1024 | 30 | 固定 | 最大Phase 1寸法 |
| D06 | background | 512×512 | 20 | 固定 | Steps差分 |
| D07 | background | 512×512 | 40 | 固定 | Steps差分 |
| D08 | prop | 512×512 | 30 | 固定 | Asset分類 |
| D09 | effect | 512×512 | 30 | 固定 | Asset分類 |
| D10 | background | 512×512 | 30 | 任意 | 再起動後Queue復元 |

現行UIがProject寸法と30 Stepsへ固定している場合、変更できないD02〜D09の条件は無理に改変せず、実際に送信された値を結果表へ記録します。UIを迂回する直接API呼び出しは禁止します。

## 5. 1件ごとの操作

1. Asset Library検索で一致しないsafe素材を入力します。
2. Dezgoモデルを明示選択して送信previewを開きます。
3. Promptのみ送信、入力素材なし、人物・キャラクター参照なし、完成Pageなしを確認します。
4. 承認上限、月間実費・予約、残高、30日保持、学習利用不明の表示を確認します。
5. payload、費用、Provider条件の3項目を確認してQueueへ追加します。
6. Queueが1件ずつ実行され、完了後にAssetを開けることを確認します。
7. 生成履歴からモデル、試行回数、計上額、費用確定方法、生成後残高、Seed、時間、寸法、Steps、Samplerを結果表へ転記します。
8. 失敗時は同じ操作を無制限に繰り返さず、error codeと試行回数だけを記録します。

D10では一度Desktopを閉じ、`MANGAI_ENABLE_DEZGO_DISPATCH`だけを削除して再起動します。最終確認後に「dispatcherが無効なため待機」と表示され、外部送信されていないことを確認してDesktopを閉じます。その後dispatcherフラグを`true`へ戻して再起動し、Job IDと費用予約を維持したまま1件だけ再開することを確認します。

## 6. 停止条件

次のいずれかで残り試験を中止します。

- 明示確認前に外部送信が始まる
- APIキーまたはDezgo user IDが画面、SQLite、ログ、診断、報告書に現れる
- Project月間上限を超えてQueueへ追加できる
- 1件の操作で複数画像が生成される
- 成人向け、人物、キャラクター参照、完成Page、入力画像が外部送信候補になる
- 計上額が承認上限を不合理に超える、または残高変化と整合しない
- cancel、timeout、画像保存失敗後の費用状態を説明できない

## 7. 終了処理

1. 10件終了後、Desktopを閉じます。
2. PowerShellの3フラグを削除します。

```powershell
Remove-Item Env:MANGAI_ENABLE_DEZGO_PROVIDER -ErrorAction SilentlyContinue
Remove-Item Env:MANGAI_ENABLE_DEZGO_DIRECT_BYOK -ErrorAction SilentlyContinue
Remove-Item Env:MANGAI_ENABLE_DEZGO_DISPATCH -ErrorAction SilentlyContinue
```

3. 継続利用しない場合は設定画面からAPIキーを削除します。
4. [`DEZGO_MANUAL_E2E_RESULTS.md`](DEZGO_MANUAL_E2E_RESULTS.md)へ結果を記録します。
5. 失敗・停止がある場合はPhase 1を完了扱いにせず、外部送信フラグを無効のままにします。
