"use server";

import { redirect } from "next/navigation";
import { exportSalesPackage, isLegacyLocalSalesEnabled, saveSalesPackageFromForm } from "@/lib/local/salesPackage";

function requireLegacyLocalTools() {
  if (!isLegacyLocalSalesEnabled()) throw new Error("ローカルファイル操作はMANGAI Desktopへ移行しました。");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "処理に失敗しました。";
}

function redirectTo(projectId: string, packageId: string, message: string) {
  redirect(`/sales-packages?projectId=${encodeURIComponent(projectId)}&packageId=${encodeURIComponent(packageId)}&message=${encodeURIComponent(message)}`);
}

export async function saveSalesPackageAction(formData: FormData) {
  requireLegacyLocalTools();
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
  requireLegacyLocalTools();
  let projectId = "default";
  let packageId = "";
  try {
    const record = await saveSalesPackageFromForm(formData, { generate: true });
    projectId = record.project_id;
    packageId = record.id;
  } catch (error) {
    redirect(`/sales-packages?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirectTo(projectId, packageId, "販売文案を作成して保存しました。");
}

export async function exportSalesPackageAction(formData: FormData) {
  requireLegacyLocalTools();
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
