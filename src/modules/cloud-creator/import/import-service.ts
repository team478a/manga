import { parseCloudProjectImport } from "@/lib/cloud-creator-contract";
import { cloudCreatorContext } from "../auth-context";
import {
  DomainError,
  isDomainError,
  ValidationError,
} from "../../../lib/domain-errors.ts";

export async function importDesktopCloudProject(value: unknown) {
  let manifest;
  try {
    manifest = parseCloudProjectImport(value);
  } catch (error) {
    if (isDomainError(error)) throw error;
    throw new ValidationError(
      "一般向けDesktop Projectのimport情報を検証できません。",
    );
  }
  const { supabase } = await cloudCreatorContext();
  const { data, error } = await supabase.rpc("import_cloud_project", {
    p_manifest: manifest,
  });
  if (error) {
    if (error.code === "23505")
      throw new ValidationError(
        "このDesktop Projectはすでにimportされています。",
      );
    throw new DomainError(
      "INTERNAL_ERROR",
      "Cloud Projectをimportできませんでした。",
      { cause: error },
    );
  }
  return data as string;
}
