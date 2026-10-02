import Link from "next/link";
import { Heart } from "lucide-react";
import { updateMarketplaceFavorite } from "@/app/actions/marketplace-favorite-actions";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";

export type MarketplaceFavoriteControl = {
  availability: "ready" | "signed-out" | "unavailable";
  isFavorite: boolean;
  returnTo: string;
};

export function MarketplaceFavoriteButton({
  control,
  variant = "compact",
  workId,
}: {
  control: MarketplaceFavoriteControl;
  variant?: "compact" | "full";
  workId: string;
}) {
  const full = variant === "full";
  const label = control.isFavorite
    ? "あとで読むから解除"
    : "あとで読むに追加";
  const className = full
    ? "inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-violet-200 bg-white px-5 text-base font-bold text-violet-800 outline-none transition hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 sm:w-auto"
    : "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/95 text-violet-700 shadow-md outline-none transition hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2";

  if (control.availability === "signed-out") {
    return (
      <Link
        aria-label="ログインしてあとで読むに追加"
        className={className}
        href={`/login?next=${encodeURIComponent(control.returnTo)}`}
      >
        <Heart aria-hidden="true" className="h-5 w-5" />
        {full ? <span className="ml-2">ログインしてあとで読む</span> : null}
      </Link>
    );
  }
  if (control.availability === "unavailable") return null;

  return (
    <form action={updateMarketplaceFavorite}>
      <input
        name="action"
        type="hidden"
        value={control.isFavorite ? "remove" : "add"}
      />
      <input name="workId" type="hidden" value={workId} />
      <input name="returnTo" type="hidden" value={control.returnTo} />
      <PendingSubmitButton
        aria-label={label}
        aria-pressed={control.isFavorite}
        className={className}
        pendingLabel={full ? "更新中…" : "…"}
        title={label}
      >
        <Heart
          aria-hidden="true"
          className={`h-5 w-5 ${control.isFavorite ? "fill-current" : ""}`}
        />
        {full ? <span className="ml-2">{label}</span> : null}
      </PendingSubmitButton>
    </form>
  );
}
