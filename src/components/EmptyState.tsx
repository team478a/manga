import Link from "next/link";

export function EmptyState({
  title,
  body,
  href,
  action
}: {
  title: string;
  body: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="panel text-center">
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-lg text-stone-600">{body}</p>
      {href && action ? (
        <Link className="button mt-5" href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}
