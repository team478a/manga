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
packages/export-core/  販売文案・PDF・ZIP・作品情報書き出しコア
packages/canvas-core/  Canvas型、座標、制約、テンプレート、縦書き、検証
src/                   MANGAI Hub（段階移行のため現位置を維持）
supabase/              Hub DBスキーマ
docs/desktop/          Desktop運用・実装資料
docs/hub/              Hub資料
```

漫画Canvasの正本はSQLiteのドメインデータです。rendererのKonvaは表示と操作を担当し、保存、マイグレーション、画像解決、SharpによるPage原寸レンダリング、PDF・ZIP生成はElectron main processで実行します。rendererからはsandboxed preloadのcontextBridgeで公開した限定APIのみを呼び出します。

既存Webの全面移動は参照パスとデプロイを壊すリスクがあるため、今回行っていません。
