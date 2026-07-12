"use server";

import { redirect } from "next/navigation";
import { exportSalesPackage, saveSalesPackageFromForm } from "@/lib/local/salesPackage";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "処理に失敗しました。";
}

function redirectTo(projectId: string, packageId: string, message: string) {
  redirect(`/sales-packages?projectId=${encodeURIComponent(projectId)}&packageId=${encodeURIComponent(packageId)}&message=${encodeURIComponent(message)}`);
}

export async function saveSalesPackageAction(formData: FormData) {
  let projectId = "default";
  let packageId = "";
  try {
    const record = await saveSalesPackageFromForm(formData);
    projectId = record.project_id;
    packageId = record.id;
  } catch (error) {
    redirect(`/sales-packages?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirectTo(projectId, packageId, "販売パッケージ情報を保存しました。");
}

export async function generateSalesTextAction(formData: FormData) {
  let projectId = "default";
  let packageId = "";
  try {
    const record = await saveSalesPackageFromForm(formData, { generate: true });
    projectId = record.project_id;
    packageId = record.id;
  } catch (error) {
    redirect(`/sales-packages?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirectTo(projectId, packageId, "AI販売文を生成して保存しました。");
}

export async function exportSalesPackageAction(formData: FormData) {
  let projectId = "default";
  let packageId = "";
  let message = "販売用ファイル一式を書き出しました。";
  try {
    const { record, outputDir } = await exportSalesPackage(formData);
    projectId = record.project_id;
    packageId = record.id;
    message = `販売用ファイル一式を書き出しました: ${outputDir}`;
  } catch (error) {
    redirect(`/sales-packages?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirectTo(projectId, packageId, message);
}
