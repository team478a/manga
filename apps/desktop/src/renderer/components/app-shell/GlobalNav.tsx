import React from "react";
import {
  Bot,
  Cloud,
  FolderKanban,
  ImagePlus,
  MessageSquare,
  Settings,
} from "lucide-react";
import { useI18n } from "../../i18n";

export type WorkspaceView = "editor" | "chat" | "jobs" | "hub" | "settings";

const items: Array<{
  id: WorkspaceView;
  labelKey: "nav.editor" | "nav.chat" | "nav.jobs" | "nav.hub" | "nav.settings";
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}> = [
  { id: "editor", labelKey: "nav.editor", icon: FolderKanban },
  { id: "chat", labelKey: "nav.chat", icon: MessageSquare },
  { id: "jobs", labelKey: "nav.jobs", icon: ImagePlus },
  { id: "hub", labelKey: "nav.hub", icon: Cloud },
  { id: "settings", labelKey: "nav.settings", icon: Settings },
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
  const { t } = useI18n();
  return (
    <nav className="global-nav" aria-label={t("nav.main")}>
      <button
        className="global-nav-brand"
        title={t("nav.projects")}
        aria-label={t("nav.projects")}
        onClick={onProjects}
      >
        M
      </button>
      <div className="global-nav-items">
        {items.map((item) => {
          const Icon = item.icon;
          const label = t(item.labelKey);
          return (
            <button
              key={item.id}
              className={active === item.id ? "selected" : ""}
              aria-current={active === item.id ? "page" : undefined}
              aria-label={label}
              title={label}
              onClick={() => onSelect(item.id)}
            >
              <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      <Bot className="global-nav-ai-mark" size={18} aria-hidden="true" />
    </nav>
  );
}
