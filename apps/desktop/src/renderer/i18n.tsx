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
