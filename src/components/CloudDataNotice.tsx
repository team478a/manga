export function CloudDataNotice({
  children = "一部の情報を一時的に読み込めませんでした。時間をおいて再読み込みしてください。",
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 ${className}`}
      role="status"
    >
      {children}
    </p>
  );
}
