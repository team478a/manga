# MANGAI Cloud Creator Editor MVP Phase 2 完了報告

完了日: 2026-07-18
対象ブランチ: `feature/manga-canvas-mvp`

## 完了したゴール

一般向け漫画をブラウザーだけで作成し、再読込後も編集を続け、PDF・連番PNG・販売パッケージへ書き出せるCloud Creator Editor MVPを実装した。Cloudでは一般向け作品だけを扱い、成人向け作品は既存の製品境界により拒否する。

## 実装範囲

- `/creator`のProject一覧、新規作成、30日以内のSoft delete・復元
- Episode・Pageの追加、名称変更、並べ替え、削除、表紙Page設定
- Project作成時に第1話・第1Page・初期Canvas・versionを同一transactionで作成
- 非公開Assetのアップロード、署名URL表示、Panel layerへの配置・表示・順序変更
- コマ、吹き出し、横書き・縦書きテキストの追加、選択、移動、拡縮、回転、表示、lock、削除、z-order
- revision付き自動保存、保存中の変更保持、競合表示、Undo / Redoとkeyboard操作
- Page preview、現在PageのPNG、作品全体のPDF、連番PNG ZIP、販売パッケージZIP
- Cloud Canvas schema検証と、Desktop由来snapshotの正規化
- creator/adminロール制限と未認証時のログイン導線

## データベース

`202607180003_cloud_creator_structure.sql`で、所有者をDB内で再確認する認証済みRPCを追加した。Project作成、Episode・Page追加、名称・順序変更、Soft delete、表紙設定をtransaction化し、最後のEpisode／Pageは削除できない。削除対象が表紙の場合は表紙参照も解除する。

PostgreSQL 16でforward、RPC動作、rollback、再適用、`schema.sql`の二重適用を確認した。migration manifestは6件で整合している。

## 検証結果

- Hub単体テスト: 22/22
- canvas-core: 26/26
- TypeScript: 成功
- ESLint: 成功
- Next.js production build: 成功
- PostgreSQL 16 forward / rollback / canonical schema: 成功
- 実ブラウザー: 未認証の`/creator`が`/login`へ遷移し、ログインフォームを表示
- Cloud Canvas PNG: コマ、吹き出し、縦書きテキストを含む320×480 PNGの生成を確認

## MVP境界と外部受入れ

- 3Page MVPのexportはHTTP request内で非同期生成する。大規模作品向けの永続export Job、進捗、再開はPhase 3のCloud Queue基盤と統合する。
- 構造化ルビ編集はMVP後のCanvas text拡張へ残す。通常文字列としてのルビ表記は保存・描画できる。
- 実Supabase stagingのmigration適用、実ユーザーでの作成・再ログイン・競合・書き出しE2Eは認証情報が必要なRC受入れ項目として残る。

## 次のゴール

Phase 3「一般向けCloud AI」。Server専用Provider adapter、永続Queue、moderation、生成履歴、費用記録を追加し、成人向け入力をProvider送信前に拒否する。
