import { useEffect, useState } from "react";

export type ShortcutEventLike = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
};

/**
 * 「このキーイベントでコマンドパレットを開くべきか」を判定する純粋関数。
 * DOM/Reactに依存しないため、node:testから直接呼び出して検証できる。
 *
 * 起動条件: Ctrl+K（Windows/Linux）またはMeta+K（macOS互換）で、
 * IME変換中でなく、Alt併用やCtrl+Meta同時押しのような想定外の修飾キー
 * 組み合わせでもない場合のみtrueを返す。
 */
export function shouldOpenCommandPalette(
  event: ShortcutEventLike,
  { disabled = false }: { disabled?: boolean } = {},
): boolean {
  if (disabled) return false;
  if (event.isComposing) return false;
  if (event.key.toLowerCase() !== "k") return false;
  if (!event.ctrlKey && !event.metaKey) return false;
  if (event.altKey || event.shiftKey) return false;
  if (event.ctrlKey && event.metaKey) return false;
  return true;
}

export type UseCommandPaletteOptions = {
  /**
   * true の間はCtrl+K/Meta+Kショートカットを無効化する。
   * 新規Project作成モーダルやExportダイアログなど、既存のモーダル操作から
   * フォーカス・ショートカットを奪わないようにするためのガード。
   */
  disabled?: boolean;
};

/**
 * コマンドパレットの開閉状態とCtrl+K/Meta+Kグローバルショートカットの登録のみを担当する。
 * コマンド項目の中身やProjectデータの知識は持たない（command-palette-items.tsの責務）。
 * 実際の起動判定はshouldOpenCommandPalette（純粋関数）に委譲する。
 */
export function useCommandPalette({ disabled = false }: UseCommandPaletteOptions = {}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldOpenCommandPalette(event, { disabled })) return;
      event.preventDefault();
      setOpen(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [disabled]);

  return {
    open,
    openPalette: () => setOpen(true),
    closePalette: () => setOpen(false),
    // 起動ボタンを再操作した場合に閉じられるようにするトグル。
    togglePalette: () => setOpen((current) => !current),
  };
}
