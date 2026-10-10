import crypto from "node:crypto";
import net from "node:net";
import {
  ExternalSubmissionIngestError,
  type ExternalSubmissionMalwareScanner,
  type ExternalSubmissionSourceFormat,
  validateExternalSubmissionSource,
} from "./external-submission-ingest";
import { createAdminClient } from "./supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type IngestClaim = {
  job_id: string;
  submission_id: string;
  lease_token: string;
  source_format: ExternalSubmissionSourceFormat;
  owner_profile_id: string;
};
type SourceFile = {
  id: string;
  storage_path: string;
  original_name: string;
};

export function createClamAvScanner(input: {
  host?: string;
  port?: number;
  timeoutMs?: number;
} = {}): ExternalSubmissionMalwareScanner {
  const host = input.host ?? process.env.MANGAI_EXTERNAL_CLAMAV_HOST;
  const port = input.port ?? Number(process.env.MANGAI_EXTERNAL_CLAMAV_PORT ?? 3310);
  const timeoutMs = input.timeoutMs ?? 15_000;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535)
    return async () => "unavailable";

  return async ({ bytes }) =>
    new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      let response = "";
      let settled = false;
      const finish = (status: "clean" | "infected" | "unavailable") => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(status);
      };
      socket.setTimeout(timeoutMs, () => finish("unavailable"));
      socket.on("error", () => finish("unavailable"));
      socket.on("data", (chunk) => {
        response += chunk.toString("utf8");
        if (response.includes("FOUND")) finish("infected");
        else if (response.includes("OK")) finish("clean");
      });
      socket.on("close", () => {
        if (!settled) finish(response.includes("OK") ? "clean" : "unavailable");
      });
      socket.on("connect", () => {
        socket.write("zINSTREAM\0");
        for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
          const chunk = Buffer.from(bytes.subarray(offset, offset + 64 * 1024));
          const length = Buffer.allocUnsafe(4);
          length.writeUInt32BE(chunk.byteLength);
          socket.write(length);
          socket.write(chunk);
        }
        socket.end(Buffer.alloc(4));
      });
    });
}

function errorCode(error: unknown) {
  return error instanceof ExternalSubmissionIngestError
    ? error.code
    : "ingest_internal_error";
}

function retryable(code: string) {
  return ["malware_scan_unavailable", "ingest_internal_error"].includes(code);
}

export async function processNextExternalSubmissionIngest(input: {
  workerId: string;
  client?: AdminClient;
  scan?: ExternalSubmissionMalwareScanner;
}) {
  const client = input.client ?? createAdminClient();
  const claimed = await client.rpc("claim_external_submission_ingest", {
    p_worker_id: input.workerId,
    p_lease_seconds: 300,
  });
  if (claimed.error) throw new Error("external_ingest_claim_failed");
  const job = claimed.data?.[0] as IngestClaim | undefined;
  if (!job) return { status: "idle" as const };

  const uploadedPaths: string[] = [];
  try {
    const filesResult = await client
      .from("external_work_submission_files")
      .select("id,storage_path,original_name")
      .eq("submission_id", job.submission_id)
      .order("created_at", { ascending: true });
    const files = (filesResult.data ?? []) as SourceFile[];
    if (filesResult.error || !files.length) throw new ExternalSubmissionIngestError("source_missing");
    if (job.source_format !== "images" && files.length !== 1)
      throw new ExternalSubmissionIngestError("source_count_invalid");

    const completedPages: Array<Record<string, string | number>> = [];
    const pageHashes = new Set<string>();
    for (const file of files) {
      const downloaded = await client.storage
        .from("external-submission-quarantine")
        .download(file.storage_path);
      if (downloaded.error || !downloaded.data)
        throw new ExternalSubmissionIngestError("source_download_failed");
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const validated = await validateExternalSubmissionSource({
        format: job.source_format === "images" ? "images" : job.source_format,
        bytes,
        fileName: file.original_name,
        scan: input.scan ?? createClamAvScanner(),
      });
      for (const page of validated.pages) {
        if (pageHashes.has(page.sha256))
          throw new ExternalSubmissionIngestError("duplicate_page");
        pageHashes.add(page.sha256);
        const id = crypto.randomUUID();
        const position = completedPages.length + 1;
        const path = `${job.owner_profile_id}/${job.submission_id}/${id}.png`;
        const uploaded = await client.storage
          .from("external-submission-pages")
          .upload(path, page.bytes, { contentType: "image/png", upsert: false });
        if (uploaded.error) throw new ExternalSubmissionIngestError("page_upload_failed");
        uploadedPaths.push(path);
        completedPages.push({
          id,
          sourceFileId: file.id,
          position,
          sourceName: page.sourceName,
          storagePath: path,
          byteSize: page.byteSize,
          width: page.width,
          height: page.height,
          sha256: page.sha256,
        });
      }
    }
    if (completedPages.length > 100)
      throw new ExternalSubmissionIngestError("page_count_invalid");
    const completed = await client.rpc("complete_external_submission_ingest", {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_pages: completedPages,
    });
    if (completed.error) throw new Error("external_ingest_completion_failed");
    return { status: "completed" as const, submissionId: job.submission_id };
  } catch (error) {
    if (uploadedPaths.length)
      await client.storage.from("external-submission-pages").remove(uploadedPaths);
    const code = errorCode(error);
    await client.rpc("fail_external_submission_ingest", {
      p_job_id: job.job_id,
      p_lease_token: job.lease_token,
      p_error_code: code,
      p_retryable: retryable(code),
    });
    return { status: "failed" as const, submissionId: job.submission_id, errorCode: code };
  }
}
