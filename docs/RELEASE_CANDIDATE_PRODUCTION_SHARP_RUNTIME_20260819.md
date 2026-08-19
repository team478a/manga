# Production Sharp Runtime Recovery — Release Candidate

## 概要

- 日付: 2026-08-19
- Base: `feature/manga-canvas-mvp` / `27f29fec96104ca60dd736f2c9781ab09dcb8b50`
- Branch: `codex/fix-production-sharp-runtime`
- 状態: `READY_FOR_OWNER_REVIEW / ALL_CI_PASSED / PREVIEW_RUNTIME_RECOVERED / PRODUCTION_UNCHANGED`
- Draft PR: [#310](https://github.com/team478a/manga/pull/310)

PR #309のProduction deploymentで、`/login`を含む主要なServer Routeが500になった。Vercel Runtime Logsで次のエラーを確認した。

```text
Failed to load external module sharp
Could not load the "sharp" module using linux-x64
ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file
```

## 原因と修正

Next.js 16のoutput file tracingが、Vercel Functionsの実行時に必要なLinux x64版Sharp native bindingとlibvips共有ライブラリを各Server Routeへ同梱していなかった。

`next.config.ts`の`outputFileTracingIncludes`へ、次の既存optional dependencyを明示した。

- `@img/sharp-linux-x64@0.35.3`
- `@img/sharp-libvips-linux-x64@1.3.2`

Sharp本体は`0.35.3`のままとし、Provider、画像生成モデル、画像処理契約は変更していない。回帰テストはtrace設定とlockfile上のnative package versionを固定し、Linux x64では両packageが解決できることも検査する。

## ローカル受入れ

- 集中回帰テスト: 成功
- Linux packageを配置したWindows build simulation: 成功
- App Router trace: 110件中110件がSharp native bindingとlibvipsの両方を含む
- `npm run deps:check`: 成功（module boundaryは既存2 warningのみ）
- `npm run lint`: 成功
- `npm run typecheck`: 成功
- `npm run hub:test`: 811/811成功
- `npm run canvas:test`: 26/26成功
- `npm run ai:test`: 48/48成功
- `npm run desktop:test`: 182/182成功
- `npm run desktop:test:a11y`: violation 0（既存の手動確認対象のみ）
- `npm run db:migrations:validate`: 61件成功
- `npm run build`: 成功
- `npm run desktop:build`: 成功
- `npm run rc:preflight`: repository structure成功。外部設定・手動E2Eの既存Pendingは差分外
- `git diff --check`: 成功

## 外部契約とProduction

次は変更していない。

- Production deployment、Production DB、Storage object、既存作品
- URL、API、Server Action、DB schema、migration、RPC
- Provider、model、pricing、credit、retry、timeout、Scheduler
- Canvas schema、PNG／PDF、成人向け境界、Desktop製品コード

本PRのmerge前にProductionへ変更を加えない。

## Preview受入れ条件

最終HEAD `bf13659df4340aad0fec90c5f54af6090986fe05`のVercel Previewで次を確認した。

1. deployment `Aki2dWcfbW1U1ZmF7jyjzhBH9Jgv`はReady。
2. Preview URLは`https://mangai-hub-staging-mcbdzcerp-team478as-projects.vercel.app`。
3. `/login`、`/works`、`/sales-packages`、`/`は200。500は0件。
4. Runtime Logsに`sharp`、`libvips`、`ERR_DLOPEN_FAILED`は0件。
5. Core quality、Migration roundtrip、Windows build、Vercel、Preview Commentsはすべて成功。

初回CIではLinux package rootを`require.resolve`した回帰テストだけが失敗した。対象packageはroot exportを持たないためであり、公開subpathの`sharp.node`と`binary`を直接解決する検査へ修正した。修正後のCore qualityは成功した。

## Rollback

本PRをrevertし、`next.config.ts`のtrace includeと回帰テストだけを取り除く。DB、Storage、Provider、作品データのrollbackは不要。

## Merge後のProduction確認

- `/login`と認証済みCreator画面が500にならないこと
- 原稿画像が表示されること
- 品質フィードバックが保存できること
- Runtime Logsに同じSharp/libvips errorが再発しないこと
