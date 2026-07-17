import crypto from "node:crypto";
import {
  externalDispatchConfirmationSchema,
  externalDispatchPreviewSchema,
  safeAssetLibraryRequestSchema,
  type ExternalDispatchConfirmation,
  type ExternalDispatchPreview,
  type SafeAssetLibraryRequest,
} from "@mangai/ai-core";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type ExternalDispatchApproval = {
  approvalToken: string;
  previewId: string;
  expiresAt: string;
};

export class ExternalDispatchApprovalError extends Error {
  constructor(
    public readonly code:
      | "PREVIEW_NOT_FOUND"
      | "PREVIEW_BLOCKED"
      | "PREVIEW_EXPIRED"
      | "PREVIEW_REQUEST_MISMATCH"
      | "CONFIRMATION_MISMATCH"
      | "CONFIRMATION_TIME_INVALID"
      | "CONTEXT_CHANGED"
      | "APPROVAL_TOKEN_INVALID"
      | "APPROVAL_TOKEN_EXPIRED",
    message: string,
  ) {
    super(message);
    this.name = "ExternalDispatchApprovalError";
  }
}

type PendingApproval = {
  preview: ExternalDispatchPreview;
  request: SafeAssetLibraryRequest;
  contextSha256: string;
  expiresAtMs: number;
};

type ApprovedDispatch = PendingApproval & {
  previewId: string;
  confirmedAt: string;
  tokenExpiresAtMs: number;
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function equalSha256(left: string, right: string) {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return crypto.timingSafeEqual(
    Buffer.from(left, "hex"),
    Buffer.from(right, "hex"),
  );
}

export class ExternalDispatchApprovalStore {
  private readonly pending = new Map<string, PendingApproval>();
  private readonly approved = new Map<string, ApprovedDispatch>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly previewTtlMs = 5 * 60_000,
    private readonly tokenTtlMs = 60_000,
    private readonly maxEntries = 100,
  ) {}

  register(
    previewInput: ExternalDispatchPreview,
    requestInput: SafeAssetLibraryRequest,
    contextSha256: string,
  ) {
    this.prune();
    const preview = externalDispatchPreviewSchema.parse(previewInput);
    const request = safeAssetLibraryRequestSchema.parse(requestInput);
    const requestMatches =
      preview.projectId === request.projectId &&
      preview.pageId === request.pageId &&
      preview.jobType === request.type &&
      preview.modelId === (request.modelId ?? null) &&
      equalSha256(preview.promptSha256, sha256(request.query));
    if (!requestMatches || !SHA256_PATTERN.test(contextSha256))
      throw new ExternalDispatchApprovalError(
        "PREVIEW_REQUEST_MISMATCH",
        "外部送信プレビューと元のRequestが一致しません。",
      );
    while (this.pending.size + this.approved.size >= this.maxEntries) {
      const oldestPending = this.pending.keys().next().value as
        | string
        | undefined;
      if (oldestPending) {
        this.pending.delete(oldestPending);
        continue;
      }
      const oldestApproved = this.approved.keys().next().value as
        | string
        | undefined;
      if (!oldestApproved) break;
      this.approved.delete(oldestApproved);
    }
    this.pending.set(preview.previewId, {
      preview,
      request,
      contextSha256,
      expiresAtMs: this.now().getTime() + this.previewTtlMs,
    });
  }

  projectIdForPreview(previewId: string) {
    return this.pending.get(previewId)?.preview.projectId ?? null;
  }

  previewFor(previewId: string) {
    return this.pending.get(previewId)?.preview ?? null;
  }

  confirm(
    confirmationInput: ExternalDispatchConfirmation,
    currentContextSha256: string,
  ): ExternalDispatchApproval {
    const confirmation = externalDispatchConfirmationSchema.parse(
      confirmationInput,
    );
    const pending = this.pending.get(confirmation.previewId);
    if (!pending)
      throw new ExternalDispatchApprovalError(
        "PREVIEW_NOT_FOUND",
        "外部送信プレビューが見つかりません。もう一度確認してください。",
      );
    if (!pending.preview.executable)
      throw new ExternalDispatchApprovalError(
        "PREVIEW_BLOCKED",
        "この外部送信プレビューは実行できません。",
      );
    const nowMs = this.now().getTime();
    if (nowMs > pending.expiresAtMs) {
      this.pending.delete(confirmation.previewId);
      throw new ExternalDispatchApprovalError(
        "PREVIEW_EXPIRED",
        "外部送信プレビューの有効期限が切れました。",
      );
    }
    if (!equalSha256(confirmation.promptSha256, pending.preview.promptSha256))
      throw new ExternalDispatchApprovalError(
        "CONFIRMATION_MISMATCH",
        "確認したPromptが現在の外部送信内容と一致しません。",
      );
    const confirmedAtMs = new Date(confirmation.confirmedAt).getTime();
    const previewCreatedAtMs = new Date(pending.preview.createdAt).getTime();
    if (
      confirmedAtMs < previewCreatedAtMs ||
      confirmedAtMs < nowMs - 60_000 ||
      confirmedAtMs > nowMs + 30_000
    )
      throw new ExternalDispatchApprovalError(
        "CONFIRMATION_TIME_INVALID",
        "外部送信の確認時刻を検証できません。",
      );
    if (!equalSha256(currentContextSha256, pending.contextSha256)) {
      this.pending.delete(confirmation.previewId);
      throw new ExternalDispatchApprovalError(
        "CONTEXT_CHANGED",
        "外部送信設定が変更されました。もう一度確認してください。",
      );
    }
    const approvalToken = crypto.randomUUID();
    const tokenExpiresAtMs = nowMs + this.tokenTtlMs;
    this.pending.delete(confirmation.previewId);
    this.approved.set(approvalToken, {
      ...pending,
      previewId: confirmation.previewId,
      confirmedAt: confirmation.confirmedAt,
      tokenExpiresAtMs,
    });
    return {
      approvalToken,
      previewId: confirmation.previewId,
      expiresAt: new Date(tokenExpiresAtMs).toISOString(),
    };
  }

  consume(approvalToken: string) {
    const approved = this.approved.get(approvalToken);
    if (!approved)
      throw new ExternalDispatchApprovalError(
        "APPROVAL_TOKEN_INVALID",
        "外部送信の承認を確認できません。",
      );
    this.approved.delete(approvalToken);
    if (this.now().getTime() > approved.tokenExpiresAtMs)
      throw new ExternalDispatchApprovalError(
        "APPROVAL_TOKEN_EXPIRED",
        "外部送信の承認期限が切れました。",
      );
    return {
      preview: approved.preview,
      request: approved.request,
      confirmedAt: approved.confirmedAt,
    };
  }

  revoke(approvalToken: string) {
    return this.approved.delete(approvalToken);
  }

  private prune() {
    const nowMs = this.now().getTime();
    for (const [previewId, value] of this.pending)
      if (nowMs > value.expiresAtMs) this.pending.delete(previewId);
    for (const [token, value] of this.approved)
      if (nowMs > value.tokenExpiresAtMs) this.approved.delete(token);
  }
}
