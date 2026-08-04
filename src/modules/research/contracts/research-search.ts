import { z } from "zod";
import {
  cloudResearchTopicSchema,
  type CloudResearchTopic,
} from "../domain/research-report.ts";

export const cloudResearchSearchInputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "検索語を入力してください。")
    .max(400, "検索語は400文字以内で入力してください。")
    .refine(
      (value) => value.split(/\s+/u).filter(Boolean).length <= 50,
      "検索語は50語以内で入力してください。",
    ),
  topic: cloudResearchTopicSchema,
  freshness: z.enum(["all", "month", "year"]),
});

export type CloudResearchSearchInput = z.infer<
  typeof cloudResearchSearchInputSchema
>;

export type CloudResearchSearchCandidate = {
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
  verificationEligible: boolean;
};

export type CloudResearchSearchResult = {
  provider: "brave-web-search";
  searchedAt: string;
  topic: CloudResearchTopic;
  candidates: CloudResearchSearchCandidate[];
};
