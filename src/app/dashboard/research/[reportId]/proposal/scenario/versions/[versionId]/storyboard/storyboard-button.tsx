"use client";
import { useFormStatus } from "react-dom";
export function StoryboardButton({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={secondary ? "button-secondary" : "button bg-violet-700 hover:bg-violet-800"} disabled={pending} type="submit">{pending ? "AIがネームを作成中…" : children}</button>;
}
