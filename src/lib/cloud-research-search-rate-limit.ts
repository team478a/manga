import { createHmac } from "node:crypto";
import { createAdminClient } from "./supabase/admin.ts";
import {
  ProviderUnavailableError,
  RateLimitedError,
} from "./domain-errors.ts";

const WINDOW_SECONDS = 60;
const GLOBAL_LIMIT = 300;
const USER_LIMIT = 10;
const CLAIM_EXTRACTION_USER_LIMIT = 20;
const AI_ANALYSIS_USER_LIMIT = 3;
const AI_PROPOSAL_USER_LIMIT = 3;
const AI_SCENARIO_USER_LIMIT = 2;

function subjectKey(value: string, secret?: string) {
  const resolved =
    secret ??
    process.env.CLOUD_RESEARCH_SEARCH_RATE_LIMIT_SECRET ??
    process.env.CLOUD_AI_RATE_LIMIT_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!resolved || Buffer.byteLength(resolved, "utf8") < 32)
    throw new ProviderUnavailableError(
      "出典検索の利用制限設定が不足しています。",
    );
  return createHmac("sha256", resolved).update(value).digest("hex");
}

type Consume = (
  scope: "global" | "user",
  key: string,
  limit: number,
) => Promise<boolean>;

async function consumeWithDatabase(
  scope: "global" | "user",
  key: string,
  limit: number,
) {
  const { data, error } = await createAdminClient().rpc(
    "consume_cloud_ai_rate_limit",
    {
      p_scope: scope,
      p_subject_key: key,
      p_request_limit: limit,
      p_window_seconds: WINDOW_SECONDS,
    },
  );
  if (error)
    throw new ProviderUnavailableError(
      "出典検索の利用制限を確認できませんでした。",
    );
  return data === true;
}

export async function enforceCloudResearchSearchRateLimit(
  profileId: string,
  dependencies: { consume?: Consume; secret?: string } = {},
) {
  const consume = dependencies.consume ?? consumeWithDatabase;
  const globalAllowed = await consume(
    "global",
    subjectKey("cloud-research-search:global", dependencies.secret),
    GLOBAL_LIMIT,
  );
  if (!globalAllowed)
    throw new RateLimitedError(
      "出典検索が混み合っています。1分後にお試しください。",
    );
  const userAllowed = await consume(
    "user",
    subjectKey(`cloud-research-search:user:${profileId}`, dependencies.secret),
    USER_LIMIT,
  );
  if (!userAllowed)
    throw new RateLimitedError(
      "出典検索は1分間に10回までです。少し待ってからお試しください。",
    );
}

export async function enforceCloudResearchClaimExtractionRateLimit(
  profileId: string,
  dependencies: { consume?: Consume; secret?: string } = {},
) {
  const consume = dependencies.consume ?? consumeWithDatabase;
  const globalAllowed = await consume(
    "global",
    subjectKey(
      "cloud-research-claim-extraction:global",
      dependencies.secret,
    ),
    GLOBAL_LIMIT,
  );
  if (!globalAllowed)
    throw new RateLimitedError(
      "事実候補の抽出が混み合っています。1分後にお試しください。",
    );
  const userAllowed = await consume(
    "user",
    subjectKey(
      `cloud-research-claim-extraction:user:${profileId}`,
      dependencies.secret,
    ),
    CLAIM_EXTRACTION_USER_LIMIT,
  );
  if (!userAllowed)
    throw new RateLimitedError(
      "事実候補の抽出は1分間に20回までです。少し待ってからお試しください。",
    );
}

export async function enforceCloudResearchAiAnalysisRateLimit(
  profileId: string,
  dependencies: { consume?: Consume; secret?: string } = {},
) {
  const consume = dependencies.consume ?? consumeWithDatabase;
  const globalAllowed = await consume(
    "global",
    subjectKey("cloud-research-ai-analysis:global", dependencies.secret),
    GLOBAL_LIMIT,
  );
  if (!globalAllowed)
    throw new RateLimitedError(
      "AI市場分析が混み合っています。1分後にお試しください。",
    );
  const userAllowed = await consume(
    "user",
    subjectKey(
      `cloud-research-ai-analysis:user:${profileId}`,
      dependencies.secret,
    ),
    AI_ANALYSIS_USER_LIMIT,
  );
  if (!userAllowed)
    throw new RateLimitedError(
      "AI市場分析は1分間に3回までです。少し待ってからお試しください。",
    );
}

export async function enforceCloudProposalAiRateLimit(
  profileId: string,
  dependencies: { consume?: Consume; secret?: string } = {},
) {
  const consume = dependencies.consume ?? consumeWithDatabase;
  const globalAllowed = await consume(
    "global",
    subjectKey("cloud-proposal-ai:global", dependencies.secret),
    GLOBAL_LIMIT,
  );
  if (!globalAllowed)
    throw new RateLimitedError(
      "AI企画提案が混み合っています。1分後にお試しください。",
    );
  const userAllowed = await consume(
    "user",
    subjectKey(`cloud-proposal-ai:user:${profileId}`, dependencies.secret),
    AI_PROPOSAL_USER_LIMIT,
  );
  if (!userAllowed)
    throw new RateLimitedError(
      "AI企画提案は1分間に3回までです。少し待ってからお試しください。",
    );
}

export async function enforceCloudScenarioAiRateLimit(
  profileId: string,
  dependencies: { consume?: Consume; secret?: string } = {},
) {
  const consume = dependencies.consume ?? consumeWithDatabase;
  const globalAllowed = await consume(
    "global",
    subjectKey("cloud-scenario-ai:global", dependencies.secret),
    GLOBAL_LIMIT,
  );
  if (!globalAllowed)
    throw new RateLimitedError(
      "AIシナリオ生成が混み合っています。1分後にお試しください。",
    );
  const userAllowed = await consume(
    "user",
    subjectKey(`cloud-scenario-ai:user:${profileId}`, dependencies.secret),
    AI_SCENARIO_USER_LIMIT,
  );
  if (!userAllowed)
    throw new RateLimitedError(
      "AIシナリオ生成は1分間に2回までです。少し待ってからお試しください。",
    );
}
