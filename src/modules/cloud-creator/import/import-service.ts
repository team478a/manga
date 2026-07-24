import { parseCloudProjectImport } from "@/lib/cloud-creator-contract";
import { cloudCreatorContext } from "../auth-context";

export async function importDesktopCloudProject(value: unknown) {
  const manifest = parseCloudProjectImport(value);
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("import_cloud_project", {
    p_manifest: manifest,
  });
  if (error) {
    if (error.code === "23505")
      throw new Error("このDesktop Projectはすでにimportされています。");
    throw new Error("Cloud Projectをimportできませんでした。");
  }
  return data as string;
}
