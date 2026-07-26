import crypto from "node:crypto";
import {
  routeGenerationJob,
  type GenerationJobDraftInput,
  type RouteDecision,
  type RoutingContextInput,
} from "@mangai/ai-core";

export interface GenerationRouteRecorder {
  createGenerationRouteDecision(input: {
    jobId: string;
    projectId: string;
    draft: GenerationJobDraftInput;
    context: RoutingContextInput;
    decision: RouteDecision;
    promptSha256: string;
  }): unknown;
}

export class GenerationRouter {
  constructor(private readonly recorder: GenerationRouteRecorder) {}

  decide(draft: GenerationJobDraftInput, context: RoutingContextInput) {
    return routeGenerationJob(draft, context);
  }

  decideAndRecord(input: {
    jobId: string;
    projectId: string;
    prompt: string;
    draft: GenerationJobDraftInput;
    context: RoutingContextInput;
  }) {
    const decision = this.decide(input.draft, input.context);
    this.recorder.createGenerationRouteDecision({
      jobId: input.jobId,
      projectId: input.projectId,
      draft: input.draft,
      context: input.context,
      decision,
      promptSha256: crypto
        .createHash("sha256")
        .update(input.prompt, "utf8")
        .digest("hex"),
    });
    return decision;
  }
}
