export function canReadFixedWorkPublication(input: {
  currentPublicationId: string | null;
  isPublic: boolean;
  owner: boolean;
  purchased: boolean;
  status: string;
}) {
  if (!input.currentPublicationId) return false;
  return (
    (input.isPublic && input.status === "published") ||
    input.owner ||
    input.purchased
  );
}
