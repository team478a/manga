import type { CloudResearchSourceVerification } from "./research-report.ts";

export type CloudResearchSourceSnapshot = {
  verification: CloudResearchSourceVerification;
  text: string;
  textSha256: string;
  textTruncated: boolean;
};
