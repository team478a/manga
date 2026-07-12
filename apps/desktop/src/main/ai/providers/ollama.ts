import {
  AIProviderError,
  type AIModelInfo,
  type ProviderConnectionResult,
  type ProviderSettings,
  type TextGenerationChunk,
  type TextGenerationProvider,
  type TextGenerationRequest,
  type TextGenerationResult,
} from "@mangai/ai-core";
import { fetchWithTimeout, safeBaseUrl } from "./http.js";
export class OllamaProvider implements TextGenerationProvider {
  id = "ollama";
  name = "Ollama";
  constructor(private settings: ProviderSettings) {}
  private url(path: string) {
    return `${safeBaseUrl(this.settings.baseUrl)}${path}`;
  }
  async checkConnection(
    signal?: AbortSignal,
  ): Promise<ProviderConnectionResult> {
    const start = Date.now();
    try {
      const response = await fetchWithTimeout(
        this.url("/api/tags"),
        {},
        this.settings.timeoutMs,
        signal,
      );
      if (!response.ok)
        throw new AIProviderError(
          "HTTP_ERROR",
          `OllamaがHTTP ${response.status}を返しました。`,
        );
      return {
        ok: true,
        message: "Ollamaへ接続できました。",
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Ollamaへ接続できません。",
      };
    }
  }
  async listModels(signal?: AbortSignal): Promise<AIModelInfo[]> {
    const response = await fetchWithTimeout(
      this.url("/api/tags"),
      {},
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok)
      throw new AIProviderError(
        "MODEL_LIST_FAILED",
        "Ollamaのモデル一覧を取得できませんでした。",
      );
    const body = (await response.json()) as {
      models?: Array<{ name: string; size?: number; modified_at?: string }>;
    };
    return (body.models ?? []).map((model) => ({
      id: model.name,
      name: model.name,
      size: model.size,
      modifiedAt: model.modified_at,
    }));
  }
  async generateText(
    request: TextGenerationRequest,
    _context?: unknown,
    signal?: AbortSignal,
  ): Promise<TextGenerationResult> {
    const response = await fetchWithTimeout(
      this.url("/api/generate"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: false,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
        }),
      },
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok)
      throw new AIProviderError(
        response.status === 404 ? "MODEL_NOT_FOUND" : "GENERATION_FAILED",
        response.status === 404
          ? "選択したOllamaモデルが見つかりません。"
          : "Ollamaの文章生成に失敗しました。",
      );
    const body = (await response.json()) as {
      response?: string;
      model?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      text: body.response ?? "",
      model: body.model ?? request.model,
      promptTokens: body.prompt_eval_count,
      completionTokens: body.eval_count,
      raw: body,
    };
  }
  async *streamText(
    request: TextGenerationRequest,
    _context?: unknown,
    signal?: AbortSignal,
  ): AsyncIterable<TextGenerationChunk> {
    const response = await fetchWithTimeout(
      this.url("/api/generate"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          prompt: request.prompt,
          system: request.systemPrompt,
          stream: true,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens,
          },
        }),
      },
      this.settings.timeoutMs,
      signal,
    );
    if (!response.ok || !response.body)
      throw new AIProviderError(
        "GENERATION_FAILED",
        "Ollamaのストリーミング生成を開始できませんでした。",
      );
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as {
          response?: string;
          done?: boolean;
          model?: string;
        };
        yield {
          text: chunk.response ?? "",
          done: Boolean(chunk.done),
          model: chunk.model,
        };
      }
    }
  }
}
