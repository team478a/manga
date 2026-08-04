import {
  claimCloudGenerationJob,
  type CloudAiAdminClient,
} from "../infrastructure/cloud-ai-repository.ts";

export async function claimNextCloudGenerationJob(input: {
  client: CloudAiAdminClient;
  workerId: string;
  leaseSeconds?: number;
}) {
  return claimCloudGenerationJob({
    client: input.client,
    workerId: input.workerId,
    leaseSeconds: input.leaseSeconds ?? 300,
  });
}
