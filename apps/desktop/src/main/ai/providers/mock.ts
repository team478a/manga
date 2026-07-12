import type {
  AIModelInfo,
  ProviderConnectionResult,
  TextGenerationChunk,
  TextGenerationProvider,
  TextGenerationRequest,
  TextGenerationResult,
} from "@mangai/ai-core";
export class MockTextProvider implements TextGenerationProvider {
  id = "mock";
  name = "Mock AI";
  async checkConnection(): Promise<ProviderConnectionResult> {
    return { ok: true, message: "モックAIへ接続しました。", latencyMs: 1 };
  }
  async listModels(): Promise<AIModelInfo[]> {
    return [{ id: "mock-text", name: "Mock Text" }];
  }
  async generateText(
    request: TextGenerationRequest,
  ): Promise<TextGenerationResult> {
    return {
      text: `モック応答: ${request.prompt}`,
      model: request.model || "mock-text",
    };
  }
  async *streamText(
    request: TextGenerationRequest,
    _context?: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<TextGenerationChunk> {
    for (const part of ["モック応答: ", request.prompt]) {
      if (signal?.aborted) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield { text: part, done: false, model: "mock-text" };
    }
    yield { text: "", done: true, model: "mock-text" };
  }
}
