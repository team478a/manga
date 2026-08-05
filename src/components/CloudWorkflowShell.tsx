"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpenCheck,
  FileText,
  FilePenLine,
  Images,
  Lightbulb,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type WorkflowItem = {
  step: number;
  label: string;
  href?: string;
  icon: LucideIcon;
  feature?: "research" | "proposal" | "scenario" | "storyboard";
  availability?: "coming-soon";
};

const workflow: WorkflowItem[] = [
  { step: 1, label: "市場分析", href: "/dashboard/research", icon: BarChart3, feature: "research" },
  {
    step: 2,
    label: "AI企画提案",
    href: "/dashboard/workflow/proposal",
    icon: Lightbulb,
    feature: "proposal",
  },
  {
    step: 3,
    label: "シナリオ作成",
    href: "/dashboard/workflow/scenario",
    icon: FileText,
    feature: "scenario",
  },
  {
    step: 4,
    label: "ネーム作成",
    href: "/dashboard/workflow/storyboard",
    icon: Sparkles,
    feature: "storyboard",
  },
  { step: 5, label: "原稿編集", href: "/creator", icon: FilePenLine },
  { step: 6, label: "作品管理", href: "/dashboard/works", icon: Images },
  {
    step: 7,
    label: "販売準備",
    icon: ShoppingBag,
    availability: "coming-soon",
  },
  {
    step: 8,
    label: "収益管理",
    icon: ReceiptText,
    availability: "coming-soon",
  },
];

function activeWorkflowStep(pathname: string) {
  if (pathname === "/creator" || pathname.startsWith("/creator/")) return 5;
  if (
    pathname === "/dashboard/works" ||
    pathname.startsWith("/dashboard/works/")
  )
    return 6;
  if (pathname.includes("/storyboard")) return 4;
  if (pathname === "/dashboard/workflow/storyboard") return 4;
  if (pathname.includes("/proposal/scenario")) return 3;
  if (pathname === "/dashboard/workflow/scenario") return 3;
  if (pathname.includes("/proposal")) return 2;
  if (pathname === "/dashboard/workflow/proposal") return 2;
  if (
    pathname === "/dashboard/research" ||
    pathname.startsWith("/dashboard/research/")
  )
    return 1;
  return null;
}

export function CloudWorkflowShell({
  accountDisplayName,
  researchEnabled,
  proposalEnabled,
  scenarioEnabled,
  storyboardEnabled,
  children,
}: {
  accountDisplayName: string;
  researchEnabled: boolean;
  proposalEnabled: boolean;
  scenarioEnabled: boolean;
  storyboardEnabled: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const currentStep = activeWorkflowStep(pathname);
  const currentItem = workflow.find((item) => item.step === currentStep);
  return (
    <div className="min-h-[calc(100vh-81px)] bg-[#f7f6ff] lg:grid lg:grid-cols-[216px_minmax(0,1fr)]">
      <aside className="border-b border-violet-100 bg-white px-3 py-4 lg:border-b-0 lg:border-r">
        <div className="mb-4 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-violet-950">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-500">
            ログイン中
          </p>
          <p className="mt-1 break-words text-sm font-bold" title={accountDisplayName}>
            {accountDisplayName}
          </p>
        </div>
        <nav aria-label="MANGAI Cloud制作ワークフロー">
          <Link
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${
              pathname === "/dashboard"
                ? "bg-violet-100 text-violet-800"
                : "text-stone-700 hover:bg-violet-50"
            }`}
            href="/dashboard"
          >
            <UserRound className="h-4 w-4" />
            マイページ
          </Link>
          <Link
            aria-current={pathname === "/dashboard/monitor/guide" ? "page" : undefined}
            className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold ${
              pathname === "/dashboard/monitor/guide"
                ? "bg-violet-100 text-violet-800"
                : "text-stone-700 hover:bg-violet-50"
            }`}
            href="/dashboard/monitor/guide"
          >
            <BookOpenCheck className="h-4 w-4" />
            使い方
          </Link>
          <p className="mt-5 px-3 text-xs font-bold uppercase tracking-wider text-stone-400">
            制作ワークフロー
          </p>
          <ol className="mt-2 flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {workflow.map((item) => {
              const active = currentStep === item.step;
              const featureEnabled = item.feature === "research"
                ? researchEnabled
                : item.feature === "proposal"
                  ? proposalEnabled
                  : item.feature === "scenario"
                    ? scenarioEnabled
                    : item.feature === "storyboard"
                      ? storyboardEnabled
                      : true;
              const enabled = Boolean(item.href) && featureEnabled;
              const status = item.availability === "coming-soon"
                ? "準備中"
                : !featureEnabled
                  ? "停止中"
                  : item.step >= 2 && item.step <= 4
                    ? "利用可能"
                    : null;
              const content = (
                <>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-current/10 text-[11px]">
                    {item.step}
                  </span>
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="whitespace-nowrap">{item.label}</span>
                    {status && !active ? (
                      <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-stone-400">
                        {status}
                      </span>
                    ) : null}
                  </span>
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
                      aria-current={active ? "page" : undefined}
                      aria-disabled={active ? undefined : "true"}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                        active
                          ? "bg-violet-100 text-violet-800"
                          : "text-stone-400"
                      }`}
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
          {currentItem ? (
            <>
              <p className="mt-1">
                ステップ{currentItem.step}：{currentItem.label}
              </p>
              <p className="mt-2 text-violet-600">
                {currentItem.step <= 4
                  ? "保存した制作データから次工程へ進めます"
                  : currentItem.step === 5
                    ? "作品・話・ページを編集"
                    : "制作した作品を管理"}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1">一般向け制作ワークフロー</p>
              <p className="mt-2 text-violet-600">
                左のメニューから工程を選択
              </p>
            </>
          )}
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
