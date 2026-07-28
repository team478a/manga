import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

export function EmptyState({
  title,
  body,
  href,
  action,
  icon,
  className,
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`text-center ${className ?? ""}`}>
      {icon ? <div className="mb-4 flex justify-center text-leaf">{icon}</div> : null}
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-lg text-stone-600">{body}</p>
      {href && action ? (
        <Link className="button mt-5" href={href}>
          {action}
        </Link>
      ) : null}
    </Card>
  );
}
