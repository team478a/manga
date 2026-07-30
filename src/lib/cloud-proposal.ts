import { z } from "zod";

export const cloudProposalFeatureEnabled = () =>
  process.env.CLOUD_PROPOSAL_GENERATION_ENABLED?.toLowerCase() === "true";

export const cloudProposalDirectionSchema = z.enum([
  "best_fit",
  "differentiated",
  "lean_test",
]);

const fitSchema = z.enum(["strong", "balanced", "challenging"]);

export const cloudStoryProposalCandidateSchema = z.object({
  id: z.string().regex(/^candidate-(best-fit|differentiated|lean-test)$/),
  direction: cloudProposalDirectionSchema,
  title: z.string().trim().min(1).max(200),
  logline: z.string().trim().min(1).max(1000),
  readerPromise: z.string().trim().min(1).max(1000),
  protagonist: z.string().trim().min(1).max(1000),
  protagonistGoal: z.string().trim().min(1).max(1000),
  centralConflict: z.string().trim().min(1).max(1000),
  tone: z.string().trim().min(1).max(500),
  differentiation: z.string().trim().min(1).max(1000),
  endingDirection: z.string().trim().min(1).max(1000),
  productStrategy: z.string().trim().min(1).max(1000),
  whyItCanSell: z.string().trim().min(1).max(1000),
  strengths: z.array(z.string().trim().min(1).max(500)).min(2).max(4),
  tradeoffs: z.array(z.string().trim().min(1).max(500)).min(1).max(3),
  salesFit: fitSchema,
  productionFit: fitSchema,
  originality: fitSchema,
});

export const cloudStoryProposalResultSchema = z.object({
  engineVersion: z.literal("openai-proposal-v1"),
  generatedAt: z.string().datetime(),
  model: z.string().min(1).max(100),
  classification: z.literal("ai_inference"),
  containsGeneratedMarketNumbers: z.literal(false),
  candidates: z.array(cloudStoryProposalCandidateSchema).length(3),
});

export type CloudStoryProposalCandidate = z.infer<
  typeof cloudStoryProposalCandidateSchema
>;
export type CloudStoryProposalResult = z.infer<
  typeof cloudStoryProposalResultSchema
>;
