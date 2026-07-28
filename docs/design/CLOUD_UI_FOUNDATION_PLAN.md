# MANGAI Cloud UI基盤刷新 実装計画

作成日: 2026-07-29
対象Phase: Cloud UI-1
作業ブランチ: `codex/cloud-ui-foundation`
基準コミット: `7615d06`（PR #47マージ後の`feature/manga-canvas-mvp`）

## 1. 目的

MANGAI Cloudの先行公開に向け、公開エリア、Dashboard、Cloud Creator、Adminを視覚的・構造的に区別できる共通UI基盤を整える。

今回の変更は表示層とlayout構造に限定する。Server Action、API、認証、Supabase、Storage、Stripe、Marketplace業務ロジック、Cloud Canvas Editor本体、Desktopコードは変更しない。

## 2. 現状監査

### 共通シェル

- `src/app/layout.tsx`が全Routeへ単一の`Header`を表示している。
- Dashboard、Creator、Adminに区画別`layout.tsx`がない。
- `Header`は公開導線とログイン後導線を同じ横並びnavへ詰め込んでいる。
- skip linkと共通main targetがない。

### 共通コンポーネント

- 共有部品は`Header`、`WorkCard`、`EmptyState`のみ。
- Page title、Card、Button、FormField、Flash message、Status表示が各pageに重複している。
- 既存の`.page`、`.panel`、`.field`、`.button`等は多くのpageが利用しているため、一括削除すると移行途中の画面を壊す。

### レスポンシブ

- Headerはdesktop幅でも折返しに依存し、区画navのmobile設計がない。
- Dashboard／Creator／Adminの画面ごとに余白・見出し・操作配置が異なる。
- Cloud Canvas Editorは独自sticky headerを持つため、Creator用sidebarをそのまま適用すると編集領域を狭める。

## 3. UIアーキテクチャ

```text
RootLayout
├─ Skip link
├─ CloudHeader（全区画共通）
└─ Route content
   ├─ Public pages（公開コンテンツ幅）
   ├─ DashboardLayout
   │  └─ SectionShell + DashboardNav
   ├─ CreatorLayout
   │  ├─ Project管理画面: SectionShell + CreatorNav
   │  └─ Canvas Editor: SectionShellを適用せず既存editorを維持
   └─ AdminLayout
      └─ SectionShell + AdminNav
```

### layout責務

- Root: ブランドHeader、skip link、全体背景、main target。
- Dashboard: 作品・商品・購入・売上・請求・端末・通知へのnav。
- Creator: Project一覧・新規作成・ゴミ箱・Dashboardへのnav。
- Admin: KPI・ユーザー・作品・商品・注文・グッズ申請・Cloud AIへのnav。
- Creator Canvas Editor: 今回は本体・独自header・保存状態・操作領域を変更しない。

## 4. 共通コンポーネント

`src/components/ui/`へ次を追加する。

| Component | 役割 |
| --- | --- |
| `Button` / `ButtonLink` | primary、secondary、ghost、dangerの操作表現 |
| `Card` | default、interactive、mutedのsurface |
| `FormField` | label、hint、error、requiredと入力要素の関連付け |
| `PageHeader` | eyebrow、title、description、actions |
| `Alert` / `FlashMessage` | info、success、warning、dangerと`aria-live` |
| `StatusBadge` | neutral、info、success、warning、danger |
| `EmptyState` | icon、title、description、action。既存propsも維持 |

`src/components/layout/`へ次を追加する。

| Component | 役割 |
| --- | --- |
| `SectionShell` | desktop sidebar／mobile横scroll navとcontent |
| `SectionNav` | pathnameに基づく現在地表示、`aria-current="page"` |
| `CreatorSectionLayout` | Canvas Editor経路だけSectionShellを除外 |

## 5. Design tokenとCSS方針

- Hubは既存のライトテーマと緑系アクセントを維持する。
- `tailwind.config.ts`へ意味ベースのsurface、border、text、status、focus、shadow tokenを追加する。
- `globals.css`へfocus-visible、skip link、共通component classを追加する。
- 既存`.panel`、`.field`、`.button`、`.button-secondary`は削除せず、新コンポーネントと並行運用する。
- 新規npm依存、CSS framework変更、Desktop側token変更は行わない。

## 6. 段階適用

1. Root layoutとCloud Header
2. Dashboard／Creator／Admin layout
3. 共通UIコンポーネント
4. 代表画面への適用
   - `/dashboard`
   - `/creator`
   - `/admin`
   - `/login`
   - `/signup`
   - `/works`
5. 既存pageは旧classでも動作する状態を維持し、後続Phaseで画面単位に移行する。

今回、全pageのmarkupを一括置換しない。業務フォームやtableの挙動を変えず、共通基盤を先に安定させる。

## 7. アクセシビリティ

- skip linkから共通main targetへ移動できる。
- navへ区画名の`aria-label`を設定する。
- 現在Routeへ`aria-current="page"`を設定する。
- focus-visible ringを全操作要素で視認できる。
- FlashMessageは成功を`role="status"`、エラーを`role="alert"`で通知する。
- iconのみの意味に依存せず、navとButtonは表示テキストを持つ。
- mobile menuはJavaScript必須にせず、標準`details`要素で開閉できる。

## 8. レスポンシブ確認

最低限、以下のviewportで確認する。

| 幅 | 確認内容 |
| --- | --- |
| 390px | Header mobile menu、区画nav横scroll、form、PageHeader actions縦積み |
| 768px | card 2列化、余白、長いnav label |
| 1024px | sidebar切替、content overflowなし |
| 1440px | desktop Header、sidebar、最大content幅 |

確認Route:

- `/`
- `/login`
- `/works`
- `/dashboard`
- `/creator`
- `/admin`

認証が必要なRouteは、ローカル環境で未認証redirectを確認し、Vercel Previewではテストアカウントによる責任者確認を行う。

## 9. 品質ゲート

```powershell
npm install
npm run deps:check
npm run lint
npm run typecheck
npm run hub:test
npm run canvas:test
npm run ai:test
npm run desktop:test
npm run db:migrations:validate
npm run build
npm run desktop:build
npm run rc:preflight
git diff --check
```

Desktop製品コードは変更しないが、monorepo回帰確認として既存Desktop test／buildを実行する。ローカルGUIを必要とする`desktop:test:a11y`は今回のWeb UIレスポンシブ確認とは分離し、GitHub ActionsのWindows結果を確認する。

## 10. 完了条件

- 区画別layoutとnavが存在し、現在地を判別できる。
- Cloud共通Headerがdesktop／mobileで利用できる。
- 指定された共通UI部品が型付きcomponentとして実装されている。
- 代表画面が共通部品を利用し、旧画面も破損せず段階移行できる。
- Cloud Canvas Editor本体、業務ロジック、API、DB、Storage、Stripe、認証、Desktopに差分がない。
- 全CIが成功している。
- レスポンシブ確認結果が記録されている。
- Draft PRを作成し、責任者承認前にはマージしない。
