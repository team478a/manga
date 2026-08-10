# PR-R4-1i Production checkpoint受入れ証跡

確認日: 2026-08-10

対象:

- Production: `https://app.mang-ai.com`
- Supabase project: `mangai-hub-staging` / `vmdsyxykcrgxcdbrwlkv`
- 検証作品: `R2C Provider Image Acceptance 2026-08-06`
- Base: `f9544035a82256ce2128f4ec1c6b4473cd4b9404`（PR #226 merge commit）

## 1. migration適用

PR #226のmergeを確認後、対象Supabaseへ`202608100001_cloud_project_checkpoint_digest_schema.sql`をSQL Editorから適用した。適用前はcheckpoint RPCの定義に`extensions.digest`がなく、checkpoint／restoreはいずれも0件だった。

適用結果は`Success. No rows returned`。適用後に次を読み取り確認した。

- `create_cloud_project_checkpoint(uuid,text,text)`は`extensions.digest`を使用する。
- RPC引数名は`p_project_id`、`p_label`、`p_kind`のまま。
- Security Definerと`search_path=public, pg_temp`を維持する。
- `authenticated`のEXECUTE権限を維持する。
- 適用直後のcheckpoint／restore件数は0件のまま。

## 2. Production checkpoint作成

認証済みProduction sessionで8ページの検証作品を開き、「バックアップを作成」を実行した。

- `作業バックアップ 2026/8/10`を1件作成できた。
- 固定版履歴へ8ページのcheckpointとして表示された。
- 作成直後は`現在と一致`と表示された。
- 生成中ページは0件で、作成を妨げるJobはなかった。

## 3. 差分と復元

作品説明だけへ一時的な検証文字列を追加して保存した。固定版履歴は`変更あり`となり、復元確認には次が表示された。

- 戻すページ: 0ページ
- 現在から外れるページ: 0ページ
- 章・話・シーン構成: 変更なし
- 素材: 変更なし
- 作品の基本設定: 変更あり

確認checkboxを選択して固定版を復元した。復元後は次を確認した。

- 自動checkpoint `復元前 作業バックアップ 2026/8/10`が作成された。
- 元checkpointへ最終復元日時が表示された。
- 元checkpointは`現在と一致`へ戻った。
- ページ再読込後、作品説明は検証文字列を含まない元の値へ戻った。
- 8ページ、9コマ、画像配置1/9、生成中0ページを維持した。

## 4. DB照合

復元後に対象作品だけを読み取り照合した。

| 項目 | 結果 |
| --- | ---: |
| checkpoint | 2件 |
| restore | 1件 |
| checkpoint page | 16行 |
| 各checkpointのpage count | 8ページ |
| generation job | 4件 |
| queued／running job | 0件 |
| active asset | 1件 |
| cost ledger event | 8件 |

受入れ開始後にgeneration jobの更新とcost ledger eventの追加はない。Assetは復元RPCの既存仕様により復元時刻へ`updated_at`が更新されたが、2 checkpointのmanifestと照合し、次をすべて確認した。

- Assetは削除状態ではない。
- SHA-256が一致する。
- byte sizeが一致する。
- width／heightが一致する。

したがって、checkpoint／restore以外のProvider実行、Job追加、credit予約・確定、費用追加、画像内容変更は発生していない。

## 5. 外部契約

今回変更した外部状態は、対象Supabaseへのmerge済みmigration適用と、検証作品のcheckpoint／restore記録だけである。application code、API、URL、Storage object、Feature Flag、Provider、model、pricing、credit、retry、timeout、Scheduler、Canvas schema、PDF／PNG仕様、成人向け境界、Stripe、Desktopは変更していない。

RPC名、引数、戻り値、権限、Security Definer、固定search pathも変更していない。

## 6. rollback

- 証跡文書は本PRのcommitをrevertする。
- Production migrationを緊急rollbackする場合は`supabase/rollbacks/202608100001_cloud_project_checkpoint_digest_schema.sql`を適用する。ただし既知の`digest()`解決障害が再発するため、通常はrollbackせずR4-1 checkpoint受入れをpendingへ戻して修正版を追加する。
- 受入れで作成したcheckpoint／restoreは監査記録として保持し、手動削除しない。

## 7. 判定と停止条件

Production checkpoint作成、差分、復元、再読込、DB永続化は合格。R4-1全体は次の外部受入れが残るためpendingを維持する。

- Cloud textの外部構成と実Job 1件
- 対象モニター本人sessionでの市場分析保存・再読込
- AIネーム由来8ページ制作E2E
- 実2利用者のowner isolation
- Stripe test E2E

ローカルのfull `rc:validate`は成功した。初回はDesktop並列実行中のComfyUI timeoutテスト1件が期待したtimeoutより先にmock応答を受けて181/182となったが、AIテスト単独30/30、同一full command再実行182/182で成功した。最終実行ではHub 627/627、migration 51/51、Hub／Desktop production buildを含む全ローカル品質ゲートが成功した。

本PRは証跡と台帳だけを変更する。Draft PRの全CIとVercel Preview成功後に停止し、責任者確認前にR4-2へ進まない。
