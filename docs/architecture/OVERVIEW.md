# MANGAI アーキテクチャ

## 製品境界

- **MANGAI Hub**: 既存のルートNext.jsアプリ。作品公開、販売、Stripe、Supabase、運営機能を担当します。
- **MANGAI Desktop**: `apps/desktop` のElectronアプリ。ローカル漫画制作プロジェクト、素材、ページ、書き出し準備を担当します。

DesktopはHubを埋め込まず、Supabase Service Role KeyやStripe Secret Keyを保持しません。HubはDesktopのローカルファイルIPCへアクセスしません。

## ディレクトリ

```text
apps/desktop/          Electron + React + Vite
packages/shared/       IPC入力用Zodスキーマ
packages/project-core/ Project/Episode/Page/Panel型と順序ロジック
packages/export-core/  販売文案・将来のPDF/ZIP書き出しコア
src/                   MANGAI Hub（段階移行のため現位置を維持）
supabase/              Hub DBスキーマ
docs/desktop/          Desktop運用・実装資料
docs/hub/              Hub資料
```

既存Webの全面移動は参照パスとデプロイを壊すリスクがあるため、今回行っていません。

