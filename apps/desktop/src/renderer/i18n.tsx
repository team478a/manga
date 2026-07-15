import React from "react";

export type AppLocale = "ja" | "en";

const ja = {
  "a11y.skipMain": "メインコンテンツへ移動",
  "a11y.dismissError": "エラー通知を閉じる",
  "nav.main": "メインナビゲーション",
  "nav.projects": "Project一覧",
  "nav.editor": "漫画編集",
  "nav.chat": "Creator Chat",
  "nav.jobs": "画像生成",
  "nav.hub": "Hub連携",
  "nav.settings": "設定",
  "header.leftPanel": "左パネル",
  "header.rightPanel": "右パネル",
  "header.toggleLeft": "構成・素材パネルを開閉",
  "header.toggleRight": "情報パネルを開閉",
  "header.undo": "元に戻す",
  "header.redo": "やり直す",
  "header.import": "インポート",
  "header.export": "書き出し",
  "header.progress": "進捗",
  "header.more": "その他の操作",
  "header.backup": "バックアップ",
  "header.history": "操作履歴",
  "header.undone": "取消済み・",
  "header.noHistory": "履歴はまだありません。",
  "status.noPage": "Page未選択",
  "status.assets": "素材 {count}",
  "home.subtitle": "漫画制作プロジェクト",
  "home.checkingBackup": "バックアップ確認中…",
  "home.autoBackup": "自動バックアップ",
  "home.restore": "バックアップから復元",
  "home.newProject": "＋ 新規プロジェクト",
  "home.recent": "最近開いたプロジェクト",
  "home.none": "プロジェクトはまだありません。",
  "home.noDescription": "説明なし",
  "home.updated": "更新: {value}",
  "home.openProject": "{title}を開く",
  "home.backup": "バックアップ",
  "home.duplicate": "複製",
  "home.delete": "削除",
  "home.deleteConfirm": "「{title}」をゴミ箱へ移動しますか？",
  "projectDialog.title": "新規プロジェクト",
  "projectDialog.name": "タイトル",
  "projectDialog.subtitle": "サブタイトル",
  "projectDialog.description": "説明",
  "projectDialog.genre": "ジャンル",
  "projectDialog.ageRating": "対象年齢",
  "projectDialog.allAges": "全年齢",
  "projectDialog.age12": "12歳以上",
  "projectDialog.age15": "15歳以上",
  "projectDialog.adult": "成人向け",
  "projectDialog.reading": "読み方向",
  "projectDialog.rtl": "右開き",
  "projectDialog.ltr": "左開き",
  "projectDialog.width": "幅",
  "projectDialog.height": "高さ",
  "projectDialog.folder": "Projectフォルダー",
  "projectDialog.defaultFolder": "既定の保存先を使用",
  "projectDialog.browse": "参照…",
  "projectDialog.reset": "既定に戻す",
  "projectDialog.cancel": "キャンセル",
  "projectDialog.create": "作成",
  "panel.projectAria": "Project構成と素材",
  "panel.projectTabs": "Projectパネル",
  "panel.structure": "構成",
  "panel.assets": "素材",
  "structure.project": "プロジェクト",
  "structure.episodes": "エピソード",
  "structure.addEpisode": "Episodeを追加",
  "structure.episodeName": "エピソード名",
  "structure.newEpisode": "新しいエピソード",
  "structure.rename": "名前変更",
  "structure.moveUp": "上へ",
  "structure.moveDown": "下へ",
  "structure.delete": "削除",
  "structure.deleteEpisodeConfirm": "「{title}」とページを削除しますか？",
  "structure.episodeTemplate": "話テンプレート",
  "structure.applyTemplateTitle": "選択中のEpisode末尾へページとコマを一括追加",
  "structure.applyTemplateConfirm":
    "「{title}」の末尾へ{name}を追加しますか？\n{description}\nこの操作は1回のUndoで戻せます。",
  "structure.applyStory": "話構成を追加",
  "structure.pages": "ページ",
  "structure.addPage": "Pageを追加",
  "structure.movePageUp": "Page {page}を上へ",
  "structure.movePageDown": "Page {page}を下へ",
  "structure.noPages": "Pageを追加してください。",
  "template.short8.name": "短編8ページ",
  "template.short8.description": "導入と締めを大きく見せる短編向け構成",
  "template.standard16.name": "標準16ページ",
  "template.standard16.description":
    "見開きの流れを意識した標準的な読み切り構成",
  "template.fourPanel8.name": "4コマ8ページ",
  "template.fourPanel8.description": "全ページを均等4コマで作成",
  "asset.add": "素材を追加",
  "asset.search": "素材名を検索",
  "asset.format": "素材形式",
  "asset.allFormats": "すべての形式",
  "asset.heading": "素材",
  "asset.count": "{visible} / {total}件",
  "asset.inUse": "使用中",
  "asset.noMatch": "条件に一致する素材はありません。",
  "asset.empty": "素材を追加するとここに表示されます。",
  "asset.makePages": "全素材を連続Page化",
  "inspector.aria": "編集パネル",
  "inspector.properties": "プロパティ",
  "inspector.layers": "レイヤー",
  "inspector.projectInfo": "プロジェクト情報",
  "inspector.title": "タイトル",
  "inspector.pageInfo": "ページ情報",
  "inspector.pageSummary": "ページ {page} / {width} × {height}",
  "inspector.duplicate": "複製",
  "inspector.delete": "削除",
  "inspector.deletePageConfirm": "ページを削除しますか？",
  "inspector.prompt": "プロンプト",
  "inspector.negativePrompt": "ネガティブプロンプト",
  "inspector.notes": "メモ",
  "inspector.selectedImage": "選択画像",
  "inspector.addToPage": "ページへ追加",
  "inspector.setCover": "代表画像に設定",
  "inspector.deleteAsset": "素材削除",
  "inspector.deleteAssetConfirm": "素材をゴミ箱へ移動しますか？",
  "saving.inProgress": "保存中…",
  "saving.saved": "保存済み",
  "saving.exporting": "書き出し中…",
  "saving.exportCanceled": "書き出しキャンセル",
  "saving.exportFailed": "書き出し失敗",
  "saving.exportCanceledMessage": "書き出しをキャンセルしました。",
  "workspace.zoomReset": "リセット",
  "workspace.noPage":
    "ページを追加してください。素材を選び「全素材を連続ページ化」も利用できます。",
  "workspace.closeInspector": "右パネルを閉じる",
  "settings.general": "一般設定",
  "settings.language": "表示言語",
  "settings.languageHelp": "主要画面から段階的に翻訳を適用しています。",
  "settings.japanese": "日本語",
  "settings.english": "English",
} as const;

type TranslationKey = keyof typeof ja;
const en: Record<TranslationKey, string> = {
  "a11y.skipMain": "Skip to main content",
  "a11y.dismissError": "Dismiss error notification",
  "nav.main": "Main navigation",
  "nav.projects": "Projects",
  "nav.editor": "Manga Editor",
  "nav.chat": "Creator Chat",
  "nav.jobs": "Image Generation",
  "nav.hub": "Hub",
  "nav.settings": "Settings",
  "header.leftPanel": "Left panel",
  "header.rightPanel": "Right panel",
  "header.toggleLeft": "Toggle structure and assets panel",
  "header.toggleRight": "Toggle inspector panel",
  "header.undo": "Undo",
  "header.redo": "Redo",
  "header.import": "Import",
  "header.export": "Export",
  "header.progress": "Progress",
  "header.more": "More actions",
  "header.backup": "Back up",
  "header.history": "History",
  "header.undone": "Undone · ",
  "header.noHistory": "No history yet.",
  "status.noPage": "No page selected",
  "status.assets": "Assets {count}",
  "home.subtitle": "Manga creation projects",
  "home.checkingBackup": "Checking backups…",
  "home.autoBackup": "Auto backup",
  "home.restore": "Restore from backup",
  "home.newProject": "+ New project",
  "home.recent": "Recent projects",
  "home.none": "No projects yet.",
  "home.noDescription": "No description",
  "home.updated": "Updated: {value}",
  "home.openProject": "Open {title}",
  "home.backup": "Back up",
  "home.duplicate": "Duplicate",
  "home.delete": "Delete",
  "home.deleteConfirm": "Move “{title}” to Trash?",
  "projectDialog.title": "New project",
  "projectDialog.name": "Title",
  "projectDialog.subtitle": "Subtitle",
  "projectDialog.description": "Description",
  "projectDialog.genre": "Genre",
  "projectDialog.ageRating": "Age rating",
  "projectDialog.allAges": "All ages",
  "projectDialog.age12": "Ages 12+",
  "projectDialog.age15": "Ages 15+",
  "projectDialog.adult": "Adults only",
  "projectDialog.reading": "Reading direction",
  "projectDialog.rtl": "Right to left",
  "projectDialog.ltr": "Left to right",
  "projectDialog.width": "Width",
  "projectDialog.height": "Height",
  "projectDialog.folder": "Project folder",
  "projectDialog.defaultFolder": "Use the default folder",
  "projectDialog.browse": "Browse…",
  "projectDialog.reset": "Use default",
  "projectDialog.cancel": "Cancel",
  "projectDialog.create": "Create",
  "panel.projectAria": "Project structure and assets",
  "panel.projectTabs": "Project panel",
  "panel.structure": "Structure",
  "panel.assets": "Assets",
  "structure.project": "Project",
  "structure.episodes": "Episodes",
  "structure.addEpisode": "Add episode",
  "structure.episodeName": "Episode name",
  "structure.newEpisode": "New episode",
  "structure.rename": "Rename",
  "structure.moveUp": "Move up",
  "structure.moveDown": "Move down",
  "structure.delete": "Delete",
  "structure.deleteEpisodeConfirm": "Delete “{title}” and its pages?",
  "structure.episodeTemplate": "Episode template",
  "structure.applyTemplateTitle":
    "Add template pages and panels to the selected episode",
  "structure.applyTemplateConfirm":
    "Add {name} to the end of “{title}”?\n{description}\nYou can undo this as one action.",
  "structure.applyStory": "Add story structure",
  "structure.pages": "Pages",
  "structure.addPage": "Add page",
  "structure.movePageUp": "Move page {page} up",
  "structure.movePageDown": "Move page {page} down",
  "structure.noPages": "Add a page to get started.",
  "template.short8.name": "8-page short story",
  "template.short8.description":
    "A short-story structure with an emphasized opening and ending",
  "template.standard16.name": "Standard 16 pages",
  "template.standard16.description":
    "A standard one-shot structure designed around page spreads",
  "template.fourPanel8.name": "Eight 4-panel pages",
  "template.fourPanel8.description": "Create every page with four equal panels",
  "asset.add": "Add assets",
  "asset.search": "Search asset names",
  "asset.format": "Asset format",
  "asset.allFormats": "All formats",
  "asset.heading": "Assets",
  "asset.count": "{visible} / {total}",
  "asset.inUse": "In use",
  "asset.noMatch": "No assets match these filters.",
  "asset.empty": "Imported assets appear here.",
  "asset.makePages": "Create pages from all assets",
  "inspector.aria": "Inspector",
  "inspector.properties": "Properties",
  "inspector.layers": "Layers",
  "inspector.projectInfo": "Project information",
  "inspector.title": "Title",
  "inspector.pageInfo": "Page information",
  "inspector.pageSummary": "Page {page} / {width} × {height}",
  "inspector.duplicate": "Duplicate",
  "inspector.delete": "Delete",
  "inspector.deletePageConfirm": "Delete this page?",
  "inspector.prompt": "Prompt",
  "inspector.negativePrompt": "Negative prompt",
  "inspector.notes": "Notes",
  "inspector.selectedImage": "Selected image",
  "inspector.addToPage": "Add to page",
  "inspector.setCover": "Set as cover",
  "inspector.deleteAsset": "Delete asset",
  "inspector.deleteAssetConfirm": "Move this asset to Trash?",
  "saving.inProgress": "Saving…",
  "saving.saved": "Saved",
  "saving.exporting": "Exporting…",
  "saving.exportCanceled": "Export canceled",
  "saving.exportFailed": "Export failed",
  "saving.exportCanceledMessage": "Export was canceled.",
  "workspace.zoomReset": "Reset",
  "workspace.noPage":
    "Add a page, or select assets and create a sequence of pages.",
  "workspace.closeInspector": "Close inspector panel",
  "settings.general": "General settings",
  "settings.language": "Display language",
  "settings.languageHelp":
    "Translation is being rolled out to the main screens in stages.",
  "settings.japanese": "日本語",
  "settings.english": "English",
};

type I18nContextValue = {
  locale: AppLocale;
  localeCode: "ja-JP" | "en-US";
  setLocale: (locale: AppLocale) => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  formatDateTime: (value: string | number | Date) => string;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function storedLocale(): AppLocale {
  try {
    return localStorage.getItem("mangai.locale") === "en" ? "en" : "ja";
  } catch {
    return "ja";
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>(storedLocale);
  const localeCode = locale === "ja" ? "ja-JP" : "en-US";
  const setLocale = React.useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem("mangai.locale", next);
    } catch {
      // 保存できない環境でも現在のセッションでは言語を切り替える。
    }
  }, []);
  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = React.useMemo<I18nContextValue>(() => {
    const messages = locale === "ja" ? ja : en;
    return {
      locale,
      localeCode,
      setLocale,
      t: (key, values = {}) =>
        Object.entries(values).reduce(
          (message, [name, replacement]) =>
            message.replaceAll(`{${name}}`, String(replacement)),
          messages[key],
        ),
      formatDateTime: (input) =>
        new Intl.DateTimeFormat(localeCode, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(input)),
    };
  }, [locale, localeCode, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = React.useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is required.");
  return value;
}
