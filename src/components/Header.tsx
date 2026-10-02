import { getCurrentProfile } from "@/lib/auth";
import { MarketplaceHeader } from "@/components/marketplace/MarketplaceHeader";

export async function Header() {
  const { profile } = await getCurrentProfile();

  return <MarketplaceHeader profile={profile} />;
}
