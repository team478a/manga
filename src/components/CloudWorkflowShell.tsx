"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Images,
  LayoutDashboard,
  Lightbulb,
  ReceiptText,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type WorkflowItem = {
  step: number;
  label: string;
  href?: string;
  icon: LucideIcon;
};

const workflow: WorkflowItem[] = [
  { step: 1, label: "市場分析", href: "/dashboard/research", icon: BarChart3 },
  { step: 2, label: "AI企画提案", href: "/dashboard/proposals", icon: Lightbulb },
  { step: 3, label: "シナリオ生成", href: "/dashboard/scenarios", icon: FileText },
  { step: 4, label: "マンガ生成", href: "/dashboard/manga", icon: Sparkles },
  { step: 5, label: "作品管理", href: "/dashboard/projects", icon: Images },
  { step: 6, label: "販売準備", icon: ShoppingBag },
  { step: 7, label: "収益ダッシュボード", icon: ReceiptText },
];

export function CloudWorkflowShell({
  researchEnabled,
  proposalEnabled,
  scenarioEnabled,
  mangaEnabled,
  workManagementEnabled,
  children,
}: {
  researchEnabled: boolean;
  proposalEnabled: boolean;
  scenarioEnabled: boolean;
  mangaEnabled: boolean;
  workManagementEnabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-[calc(100vh-81px)] bg-[#f7f6ff] lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="border-b border-violet-100 bg-white px-3 py-4 lg:border-b-0 lg:border-r">
        <nav aria-label="MANGAI Cloud制作ワークフロー">
          <Link
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${
              pathname === "/dashboard"
                ? "bg-violet-100 text-violet-800"
                : "text-stone-700 hover:bg-violet-50"
            }`}
            href="/dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
            ダッシュボード
          </Link>
          <p className="mt-5 px-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            制作ワークフロー
          </p>
          <ol className="mt-2 flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {workflow.map((item) => {
              const active = item.href
                ? pathname === item.href || pathname.startsWith(`${item.href}/`)
                : false;
              const enabled =
                Boolean(item.href) &&
                (item.step !== 1 || researchEnabled) &&
                (item.step !== 2 || (researchEnabled && proposalEnabled)) &&
                (item.step !== 3 || (researchEnabled && proposalEnabled && scenarioEnabled)) &&
                (item.step !== 4 || (researchEnabled && proposalEnabled && scenarioEnabled && mangaEnabled)) &&
                (item.step !== 5 || (researchEnabled && proposalEnabled && scenarioEnabled && mangaEnabled && workManagementEnabled));
              const content = (
                <>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-[11px]">
                    {item.step}
                  </span>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </>
              );
              return (
                <li key={item.step}>
                  {enabled && item.href ? (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                        active
                          ? "bg-violet-100 text-violet-800"
                          : "text-stone-600 hover:bg-violet-50 hover:text-violet-800"
                      }`}
                      href={item.href}
                    >
                      {content}
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-400"
                    >
                      {content}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="mt-6 hidden rounded-lg border border-violet-100 bg-violet-50 p-3 text-xs leading-relaxed text-violet-900 lg:block">
          <p className="font-bold">現在の制作進行</p>
          <p className="mt-1">Release 5：作品管理MVP</p>
          <p className="mt-2 text-violet-600">
            市場分析: {researchEnabled ? "有効" : "停止中"}
            <br />
            企画提案: {proposalEnabled ? "有効" : "停止中"}
            <br />
            シナリオ: {scenarioEnabled ? "有効" : "停止中"}
            <br />
            マンガ下書き: {mangaEnabled ? "有効" : "停止中"}
            <br />
            作品管理: {workManagementEnabled ? "有効" : "停止中"}
          </p>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
