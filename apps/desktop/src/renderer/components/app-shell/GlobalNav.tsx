import React from "react";
import {
  Bot,
  Cloud,
  FolderKanban,
  ImagePlus,
  MessageSquare,
  Settings,
} from "lucide-react";

export type WorkspaceView = "editor" | "chat" | "jobs" | "hub" | "settings";

const items: Array<{
  id: WorkspaceView;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "editor", label: "漫画編集", icon: FolderKanban },
  { id: "chat", label: "Creator Chat", icon: MessageSquare },
  { id: "jobs", label: "画像生成", icon: ImagePlus },
  { id: "hub", label: "Hub連携", icon: Cloud },
  { id: "settings", label: "設定", icon: Settings },
];

export function GlobalNav({
  active,
  onSelect,
  onProjects,
}: {
  active: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
  onProjects: () => void;
}) {
  return (
    <nav className="global-nav" aria-label="メインナビゲーション">
      <button
        className="global-nav-brand"
        title="Project一覧"
        aria-label="Project一覧"
        onClick={onProjects}
      >
        M
      </button>
      <div className="global-nav-items">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={active === item.id ? "selected" : ""}
              aria-current={active === item.id ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <Bot className="global-nav-ai-mark" size={18} aria-hidden="true" />
    </nav>
  );
}
