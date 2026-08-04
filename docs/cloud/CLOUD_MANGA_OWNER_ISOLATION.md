# Cloud漫画制作 所有者分離チェック

## 目的

一般ユーザー同士で、非公開作品、生成Job、書き出しファイル、品質フィードバックを相互参照・操作できない状態を維持します。

## 自動検査

```bash
npm run cloud:manga:owner-isolation
```

この検査は次を確認します。

- 非公開作品の編集権限が、所有者、承認済み編集者、管理者に限定されている
- 生成Jobの参照・登録・キャンセルが作品の編集権限で保護されている
- 書き出しJobの参照・状態変更が作成者本人に限定されている
- 管理Storageで署名URLを発行する前に、認証済み利用者とJob作成者が一致している
- 品質フィードバックの所有者と対象作品がサーバーおよびRLSで照合される
- URL内のJob IDがAPI到達前にUUIDとして検証される

この検査は `npm run cloud:manga:acceptance:repo` にも含まれます。

## ステージング最終確認

自動検査に加え、公開前に2つの一般ユーザーを用意して次を確認します。

1. ユーザーAで非公開作品を作成し、画像生成とPDF書き出しを完了する。
2. ユーザーBでユーザーAの作品URL、Job ID、書き出しURLへアクセスする。
3. 作品編集、Job参照・キャンセル、PDF取得、品質報告がすべて拒否または未検出になることを確認する。
4. ユーザーAでは従来どおり参照・操作できることを確認する。
5. 承認済み共同編集者の機能は、作品の設定どおり利用できることを確認する。

内部DBエラー、Storageパス、署名情報は画面へ表示しません。

### 読み取り専用の2ユーザー検査

最終ブラウザ確認の前に、2ユーザーのRLS分離を読み取り専用で確認できます。認証情報はローカル環境変数だけに設定し、リポジトリ、ログ、結果文書へ記録しません。

必要な環境変数:

```text
MANGAI_DB_ENV=staging
MANGAI_OWNER_TEST_SUPABASE_URL
MANGAI_OWNER_TEST_SUPABASE_ANON_KEY
MANGAI_OWNER_TEST_USER_A_EMAIL
MANGAI_OWNER_TEST_USER_A_PASSWORD
MANGAI_OWNER_TEST_USER_B_EMAIL
MANGAI_OWNER_TEST_USER_B_PASSWORD
MANGAI_OWNER_TEST_CONFIRM=READ_ONLY_STAGING
```

値を表示せず設定不足だけを確認します。

```powershell
npm run cloud:manga:owner-isolation:staging:preflight
```

ユーザーAに一般向け非公開作品、生成Job、書き出しJob、作品紐付き品質報告が揃った後に実行します。

```powershell
npm run cloud:manga:owner-isolation:staging
```

検査はデータの作成、更新、取消、削除、署名URL発行を行いません。ユーザーAが各対象を1件参照でき、ユーザーBからは0件になることだけを確認します。署名URL、キャンセル操作、共同編集者はブラウザで別途確認します。

## 変更しないもの

- Supabase migrationとRLS定義
- Provider、Worker、課金、成人向け処理
- 公開作品の閲覧仕様
- 共同編集者の既存権限
