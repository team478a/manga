import type { CloudAiAdminClient } from "../infrastructure/cloud-ai-repository.ts";
import type { ClaimedCloudGenerationJob } from "../domain/generation-job.ts";
import { CloudGenerationLeaseLostError } from "../domain/cloud-ai-errors.ts";

export function createCloudJobLeaseHeartbeat(input: {
  client: CloudAiAdminClient;
  job: ClaimedCloudGenerationJob;
  leaseSeconds: number;
  intervalMs?: number;
  toleratedFailures?: number;
}) {
  const controller = new AbortController();
  const intervalMs = Math.max(10, input.intervalMs ?? 60_000);
  const toleratedFailures = Math.max(0, input.toleratedFailures ?? 1);
  let consecutiveFailures = 0;
  let lost = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | undefined;

  const extend = async () => {
    const { error } = await input.client.rpc(
      "extend_cloud_generation_job_lease",
      {
        p_job_id: input.job.id,
        p_lease_token: input.job.lease_token,
        p_lease_seconds: input.leaseSeconds,
      },
    );
    if (error) throw new CloudGenerationLeaseLostError();
  };
  const schedule = () => {
    if (stopped || lost) return;
    timer = setTimeout(() => {
      inFlight = (async () => {
        try {
          await extend();
          consecutiveFailures = 0;
        } catch {
          consecutiveFailures += 1;
          if (consecutiveFailures > toleratedFailures) {
            lost = true;
            controller.abort();
          }
        } finally {
          inFlight = undefined;
          schedule();
        }
      })();
    }, intervalMs);
  };
  schedule();

  return {
    signal: controller.signal,
    get leaseLost() {
      return lost;
    },
    async assertLease() {
      if (lost) throw new CloudGenerationLeaseLostError();
      try {
        await extend();
        consecutiveFailures = 0;
      } catch {
        lost = true;
        controller.abort();
        throw new CloudGenerationLeaseLostError();
      }
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    },
  };
}
