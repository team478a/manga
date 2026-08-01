import type { CloudCreatorClient } from "../auth-context";

type ThumbnailRow = {
  page_id: string;
  storage_path: string;
};

async function signedThumbnailMap(
  supabase: CloudCreatorClient,
  pageIds: string[],
) {
  if (!pageIds.length) return new Map<string, string>();
  const rows = await supabase
    .from("cloud_page_thumbnails")
    .select("page_id,storage_path")
    .in("page_id", pageIds)
    .eq("status", "ready")
    .not("storage_path", "is", null);
  // The thumbnail migration can be deployed after the application without
  // breaking the editor. Until then, cards use the existing placeholder.
  if (rows.error || !rows.data?.length) return new Map<string, string>();
  const thumbnails = rows.data as ThumbnailRow[];
  const paths = thumbnails.map((row) => row.storage_path);
  const signed = await supabase.storage
    .from("cloud-cache")
    .createSignedUrls(paths, 600);
  if (signed.error || !signed.data) return new Map<string, string>();
  return new Map(
    thumbnails.flatMap((row, index) => {
      const url = signed.data[index]?.signedUrl;
      return url ? [[row.page_id, url] as const] : [];
    }),
  );
}

export async function attachPageThumbnailUrls<
  T extends { id: string },
>(supabase: CloudCreatorClient, pages: T[]) {
  const urls = await signedThumbnailMap(
    supabase,
    pages.map((page) => page.id),
  );
  return pages.map((page) => ({
    ...page,
    thumbnail_url: urls.get(page.id) ?? null,
  }));
}

export async function attachProjectThumbnailUrls<
  T extends { cover_page_id: string | null },
>(supabase: CloudCreatorClient, projects: T[]) {
  const urls = await signedThumbnailMap(
    supabase,
    projects.flatMap((project) =>
      project.cover_page_id ? [project.cover_page_id] : [],
    ),
  );
  return projects.map((project) => ({
    ...project,
    thumbnail_url: project.cover_page_id
      ? (urls.get(project.cover_page_id) ?? null)
      : null,
  }));
}
