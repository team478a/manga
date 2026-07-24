import type { CloudCreatorClient } from "../auth-context";

export function findProjectAssets(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_assets")
    .select(
      "id,project_id,file_name,mime_type,byte_size,width,height,sha256,storage_path",
    )
    .eq("project_id", projectId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
}

export function findProjectStorage(
  supabase: CloudCreatorClient,
  projectId: string,
) {
  return supabase
    .from("cloud_projects")
    .select("id,storage_bytes")
    .eq("id", projectId)
    .is("deleted_at", null)
    .single();
}

export function createAssetRow(
  supabase: CloudCreatorClient,
  row: {
    id: string;
    project_id: string;
    owner_profile_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    byte_size: number;
    width: number;
    height: number;
    sha256: string;
  },
) {
  return supabase.from("cloud_assets").insert(row).select("*").single();
}

export function findAssetStorage(
  supabase: CloudCreatorClient,
  assetId: string,
) {
  return supabase
    .from("cloud_assets")
    .select("storage_path")
    .eq("id", assetId)
    .is("deleted_at", null)
    .single();
}
