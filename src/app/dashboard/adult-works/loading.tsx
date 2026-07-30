export default function CloudAdultWorksLoading() {
  return (
    <main className="page" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded bg-violet-100" />
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="h-56 animate-pulse rounded-xl bg-white" />
        <div className="h-56 animate-pulse rounded-xl bg-white" />
      </div>
    </main>
  );
}
