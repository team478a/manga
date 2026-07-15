import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers";
import { randomUUID } from "node:crypto";
import { OllamaProvider } from "../dist-main/main/ai/providers/ollama.js";
import { ComfyUIProvider } from "../dist-main/main/ai/providers/comfyui.js";
import { MangaiDatabase } from "../dist-main/main/database.js";
import { AIService } from "../dist-main/main/ai/service.js";
import { safeBaseUrl } from "../dist-main/main/ai/providers/http.js";
import { chatRequestSchema } from "@mangai/ai-core";
process.env.MANGAI_ENABLE_MOCK_AI = "true";
const settings = (providerId, baseUrl) => ({
  providerId,
  enabled: true,
  baseUrl,
  modelId: "test-model",
  temperature: 0.7,
  maxTokens: 100,
  timeoutMs: 1000,
  stream: true,
  pollIntervalMs: 10,
  allowedOrigins: [],
});
async function server(handler) {
  const instance = http.createServer(handler);
  await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  const address = instance.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => instance.close(resolve)),
  };
}
test("AI connection URL requires loopback or an explicit HTTPS origin", () => {
  assert.equal(safeBaseUrl("http://127.0.0.1:11434"), "http://127.0.0.1:11434");
  assert.equal(safeBaseUrl("http://localhost:8188/"), "http://localhost:8188");
  assert.equal(
    safeBaseUrl("https://ai.example.com:8188", [
      "https://ai.example.com:8188",
    ]),
    "https://ai.example.com:8188",
  );
  assert.throws(
    () => safeBaseUrl("http://192.168.1.20:11434", ["https://192.168.1.20"]),
    /HTTPS/,
  );
  assert.throws(
    () => safeBaseUrl("https://ai.example.com:8188"),
    /許可リスト/,
  );
  assert.throws(
    () =>
      safeBaseUrl("https://ai.example.com:8188", [
        "https://ai.example.com:443",
      ]),
    /許可リスト/,
  );
  assert.throws(
    () => safeBaseUrl("http://user:pass@localhost:11434"),
    /不正/,
  );
  assert.throws(
    () => safeBaseUrl("http://localhost:11434/api"),
    /不正/,
  );
});
test("Ollama connection, models, generation and stream cancellation", async () => {
  const mock = await server((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/tags")
      return res.end(
        JSON.stringify({ models: [{ name: "manga:latest", size: 42 }] }),
      );
    if (req.url === "/api/generate") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const input = JSON.parse(body);
        if (input.stream) {
          res.write(JSON.stringify({ response: "hello ", done: false }) + "\n");
          setTimeout(
            () =>
              res.end(JSON.stringify({ response: "world", done: true }) + "\n"),
            20,
          );
        } else
          res.end(
            JSON.stringify({ response: "completed", model: input.model }),
          );
      });
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
  try {
    const provider = new OllamaProvider(settings("ollama", mock.url));
    assert.equal((await provider.checkConnection()).ok, true);
    assert.equal((await provider.listModels())[0].id, "manga:latest");
    assert.equal(
      (await provider.generateText({ model: "manga:latest", prompt: "test" }))
        .text,
      "completed",
    );
    const controller = new globalThis.AbortController(),
      chunks = [];
    for await (const chunk of provider.streamText(
      { model: "manga:latest", prompt: "test" },
      undefined,
      controller.signal,
    )) {
      chunks.push(chunk.text);
      controller.abort();
      break;
    }
    assert.deepEqual(chunks, ["hello "]);
  } finally {
    await mock.close();
  }
});
test("Ollama connection failure returns a user-facing result", async () => {
  const provider = new OllamaProvider({
    ...settings("ollama", "http://127.0.0.1:1"),
    timeoutMs: 100,
  });
  const result = await provider.checkConnection();
  assert.equal(result.ok, false);
  assert.match(result.message, /接続|タイムアウト/);
});
test("AI HTTP requests do not follow redirects", async () => {
  let redirected = false;
  const mock = await server((req, res) => {
    if (req.url === "/api/tags") {
      res.statusCode = 302;
      res.setHeader("location", "/unexpected");
      return res.end();
    }
    redirected = true;
    res.end(JSON.stringify({ models: [] }));
  });
  try {
    const result = await new OllamaProvider(
      settings("ollama", mock.url),
    ).checkConnection();
    assert.equal(result.ok, false);
    assert.equal(redirected, false);
  } finally {
    await mock.close();
  }
});
test("ComfyUI queue, status and image retrieval", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nzsAAAAASUVORK5CYII=",
    "base64",
  );
  const mock = await server((req, res) => {
    if (req.url === "/system_stats") return res.end("{}");
    if (req.url === "/prompt")
      return res.end(JSON.stringify({ prompt_id: "job-1" }));
    if (req.url === "/history/job-1")
      return res.end(
        JSON.stringify({
          "job-1": {
            status: { status_str: "success" },
            outputs: {
              9: {
                images: [
                  { filename: "result.png", subfolder: "", type: "output" },
                ],
              },
            },
          },
        }),
      );
    if (req.url?.startsWith("/view?")) {
      res.setHeader("content-type", "image/png");
      return res.end(png);
    }
    res.statusCode = 404;
    res.end("{}");
  });
  try {
    const provider = new ComfyUIProvider(
      settings("comfyui", mock.url),
      async () => ({
        workflow: { 6: { inputs: { text: "" } } },
        mapping: { prompt: { nodeId: "6", input: "text" } },
      }),
    );
    assert.equal((await provider.checkConnection()).ok, true);
    const queued = await provider.generateImage({
      workflowId: "w",
      prompt: "cat",
    });
    assert.equal(queued.providerJobId, "job-1");
    const status = await provider.getJobStatus("job-1");
    assert.equal(status.status, "completed");
    const images = await provider.downloadImages("job-1", status.outputs);
    assert.equal(images[0].fileName, "result.png");
  } finally {
    await mock.close();
  }
});
test("AI settings, chat and jobs survive database reopening", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    };
  let db = new MangaiDatabase(paths);
  const settingsValue = settings("ollama", "http://127.0.0.1:11434");
  db.saveProviderSettings(settingsValue);
  db.saveProviderSettings(settingsValue);
  const settingsHistory = db.listAISettingsHistory();
  assert.equal(settingsHistory.length, 1);
  assert.equal(settingsHistory[0].summary.endpointKind, "local");
  assert.equal(JSON.stringify(settingsHistory).includes("127.0.0.1"), false);
  db.saveAIModels("ollama", [{ id: "manga:latest", name: "Manga", size: 42 }]);
  const project = db.createProject({
      title: "AI漫画",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 1000,
      height: 1500,
      dpi: 300,
    }),
    session = db.createChatSession(project.project.id, "相談");
  db.addChatMessage(session, "user", "こんにちは");
  const job = db.createGenerationJob({
    projectId: project.project.id,
    providerType: "text",
    providerId: "ollama",
    generationType: "chat",
    prompt: "hello",
  });
  db.updateGenerationJob(job, "running");
  db.close();
  db = new MangaiDatabase(paths);
  assert.equal(
    db.getProviderSettings().find((x) => x.providerId === "ollama").enabled,
    true,
  );
  assert.equal(db.listChatMessages(session).length, 1);
  const recovered = db
    .listGenerationJobs(project.project.id)
    .find((x) => x.id === job);
  assert.equal(recovered.status, "failed");
  assert.equal(recovered.errorCode, "INTERRUPTED");
  assert.equal(db.listPromptTemplates().length, 11);
  assert.equal(db.listAISettingsHistory().length, 1);
  const builtinTemplate = db.listPromptTemplates()[0];
  assert.throws(
    () =>
      db.savePromptTemplate({
        id: builtinTemplate.id,
        name: "変更不可",
        template: "変更不可",
        systemPrompt: "",
      }),
    /初期テンプレートは上書きできません/,
  );
  let templateList = db.savePromptTemplate({
    name: `${builtinTemplate.name} のコピー`,
    template: builtinTemplate.template,
    systemPrompt: "編集用",
  });
  const copiedTemplate = templateList.find(
    (template) => template.name === `${builtinTemplate.name} のコピー`,
  );
  assert.equal(copiedTemplate.isBuiltin, 0);
  templateList = db.savePromptTemplate({
    id: copiedTemplate.id,
    name: "編集済みテンプレート",
    template: "更新した本文",
    systemPrompt: "更新したシステムプロンプト",
  });
  assert.equal(
    templateList.find((template) => template.id === copiedTemplate.id).template,
    "更新した本文",
  );
  assert.equal(db.listAIModels("ollama")[0].id, "manga:latest");
  assert.equal(db.listAIModels("ollama")[0].cached, true);
  db.close();
  fs.rmSync(root, { recursive: true, force: true });
});
test("invalid IPC-shaped AI input is rejected", () => {
  assert.equal(
    chatRequestSchema.safeParse({ requestId: "bad", message: "" }).success,
    false,
  );
});

test("Mock AI is rejected unless test mode is explicitly enabled", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-no-mock-ai-"));
  const paths = {
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  try {
    await assert.rejects(
      new AIService(db, { allowMock: false }).sendChat(
        {
          requestId: randomUUID(),
          message: "hello",
          includeContext: false,
        },
        () => {},
      ),
      /AIが設定されていません/,
    );
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Creator Chat streams and persists a mock response", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-chat-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    },
    db = new MangaiDatabase(paths);
  try {
    const project = db.createProject({
        title: "相談漫画",
        subtitle: "",
        description: "説明",
        genre: "",
        ageRating: "全年齢",
        readingDirection: "rtl",
        width: 500,
        height: 700,
        dpi: 300,
      }),
      events = [],
      requestId = randomUUID();
    await new AIService(db).sendChat(
      {
        requestId,
        projectId: project.project.id,
        message: "企画を考えて",
        includeContext: true,
      },
      (event) => events.push(event),
    );
    assert.equal(
      events.some((event) => event.type === "chunk"),
      true,
    );
    assert.equal(events.at(-1).type, "complete");
    const sessions = db.listChatSessions(project.project.id);
    assert.equal(sessions.length, 1);
    assert.equal(db.listChatMessages(sessions[0].id).length, 2);
    assert.equal(
      db.listGenerationJobs(project.project.id)[0].status,
      "completed",
    );
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ComfyUI generation is saved as a project asset", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nzsAAAAASUVORK5CYII=",
    "base64",
  );
  const mock = await server((req, res) => {
    if (req.url === "/prompt")
      return res.end(JSON.stringify({ prompt_id: "asset-job" }));
    if (req.url === "/history/asset-job")
      return res.end(
        JSON.stringify({
          "asset-job": {
            status: { status_str: "success" },
            outputs: {
              9: { images: [{ filename: "generated.png", type: "output" }] },
            },
          },
        }),
      );
    if (req.url?.startsWith("/view?")) {
      res.setHeader("content-type", "image/png");
      return res.end(png);
    }
    res.end("{}");
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-image-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    },
    db = new MangaiDatabase(paths);
  try {
    db.saveProviderSettings({
      ...settings("comfyui", mock.url),
      pollIntervalMs: 10,
    });
    const project = db.createProject({
      title: "生成素材",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const workflowFile = path.join(root, "workflow.json");
    fs.writeFileSync(
      workflowFile,
      JSON.stringify({ 6: { inputs: { text: "" } } }),
    );
    const workflow = db.registerComfyWorkflow("test", workflowFile, {
      prompt: { nodeId: "6", input: "text" },
    })[0];
    const result = await new AIService(db).generateImage({
      projectId: project.project.id,
      workflowId: workflow.id,
      prompt: "cat",
      negativePrompt: "",
    });
    assert.equal(result.status, "completed");
    assert.equal(result.bundle.assets.length, 1);
    assert.equal(result.bundle.assets[0].fileName, "generated.png");
    assert.equal(db.listGenerationJobs(project.project.id)[0].progress, 1);
    assert.equal(
      db.listOperationHistory(project.project.id).items[0].label,
      "AI生成素材を追加",
    );
    const generatedAsset = result.bundle.assets[0];
    const generatedAssetPath = path.join(
      result.bundle.project.storagePath,
      generatedAsset.relativePath,
    );
    let bundle = db.undo(project.project.id);
    assert.equal(bundle.assets.length, 0);
    assert.equal(bundle.project.coverAssetId, null);
    assert.equal(fs.existsSync(generatedAssetPath), false);
    assert.equal(db.listGenerationJobs(project.project.id)[0].status, "completed");

    bundle = db.redo(project.project.id);
    assert.equal(bundle.assets[0].id, generatedAsset.id);
    assert.equal(bundle.project.coverAssetId, generatedAsset.id);
    assert.equal(fs.existsSync(generatedAssetPath), true);
    assert.equal(db.listGenerationJobs(project.project.id)[0].status, "completed");
  } finally {
    db.close();
    await mock.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ComfyUI multi-image registration rolls back partial assets", async () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nzsAAAAASUVORK5CYII=",
    "base64",
  );
  const mock = await server((req, res) => {
    if (req.url === "/prompt")
      return res.end(JSON.stringify({ prompt_id: "partial-job" }));
    if (req.url === "/history/partial-job")
      return res.end(
        JSON.stringify({
          "partial-job": {
            status: { status_str: "success" },
            outputs: {
              9: {
                images: [
                  { filename: "good.png", type: "output" },
                  { filename: "broken.png", type: "output" },
                ],
              },
            },
          },
        }),
      );
    if (req.url?.includes("filename=good.png")) return res.end(png);
    if (req.url?.includes("filename=broken.png"))
      return res.end(Buffer.from("not-an-image"));
    res.end("{}");
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-image-rollback-"));
  const paths = {
    root,
    database: path.join(root, "db.sqlite"),
    projects: path.join(root, "projects"),
    assets: path.join(root, "assets"),
    exports: path.join(root, "exports"),
    logs: path.join(root, "logs"),
  };
  const db = new MangaiDatabase(paths);
  try {
    db.saveProviderSettings({
      ...settings("comfyui", mock.url),
      pollIntervalMs: 10,
    });
    const project = db.createProject({
      title: "部分失敗",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const workflowFile = path.join(root, "workflow.json");
    fs.writeFileSync(
      workflowFile,
      JSON.stringify({ 6: { inputs: { text: "" } } }),
    );
    const workflow = db.registerComfyWorkflow("partial", workflowFile, {
      prompt: { nodeId: "6", input: "text" },
    })[0];
    await assert.rejects(
      new AIService(db).generateImage({
        projectId: project.project.id,
        workflowId: workflow.id,
        prompt: "cat",
        negativePrompt: "",
      }),
    );
    assert.equal(db.bundle(project.project.id).assets.length, 0);
    assert.equal(db.listOperationHistory(project.project.id).items.length, 0);
    assert.equal(db.listGenerationJobs(project.project.id)[0].status, "failed");
  } finally {
    db.close();
    await mock.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ComfyUI timeout and cancellation update generation jobs", async () => {
  const mock = await server((req, res) => {
    if (req.url === "/prompt")
      return res.end(JSON.stringify({ prompt_id: "slow-job" }));
    if (req.url === "/interrupt") return res.end("{}");
    res.end("{}");
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-cancel-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    },
    db = new MangaiDatabase(paths);
  try {
    db.saveProviderSettings({
      ...settings("comfyui", mock.url),
      timeoutMs: 5000,
      pollIntervalMs: 10,
    });
    const project = db.createProject({
      title: "停止",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const workflowFile = path.join(root, "workflow.json");
    fs.writeFileSync(
      workflowFile,
      JSON.stringify({ 6: { inputs: { text: "" } } }),
    );
    const workflow = db.registerComfyWorkflow("slow", workflowFile, {
        prompt: { nodeId: "6", input: "text" },
      })[0],
      service = new AIService(db),
      pending = service.generateImage({
        projectId: project.project.id,
        workflowId: workflow.id,
        prompt: "cat",
        negativePrompt: "",
      });
    await new Promise((resolve) => setTimeout(resolve, 40));
    const job = db.listGenerationJobs(project.project.id)[0];
    service.cancel(job.id);
    const result = await pending;
    assert.equal(result.status, "canceled");
    assert.equal(
      db.listGenerationJobs(project.project.id)[0].status,
      "canceled",
    );
    assert.ok(db.listGenerationJobs(project.project.id)[0].progress >= 0.15);
  } finally {
    db.close();
    await mock.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ComfyUI provider reports failed history", async () => {
  const mock = await server((req, res) => {
    if (req.url === "/history/failed-job")
      return res.end(
        JSON.stringify({ "failed-job": { status: { status_str: "error" } } }),
      );
    res.end("{}");
  });
  try {
    const provider = new ComfyUIProvider(
      settings("comfyui", mock.url),
      async () => ({ workflow: {}, mapping: {} }),
    );
    const status = await provider.getJobStatus("failed-job");
    assert.equal(status.status, "failed");
  } finally {
    await mock.close();
  }
});

test("ComfyUI timeout marks the job as failed", async () => {
  const mock = await server((req, res) => {
    if (req.url === "/prompt")
      return res.end(JSON.stringify({ prompt_id: "timeout-job" }));
    res.end("{}");
  });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-timeout-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    },
    db = new MangaiDatabase(paths);
  try {
    db.saveProviderSettings({
      ...settings("comfyui", mock.url),
      timeoutMs: 50,
      pollIntervalMs: 10,
    });
    const project = db.createProject({
      title: "時間切れ",
      subtitle: "",
      description: "",
      genre: "",
      ageRating: "全年齢",
      readingDirection: "rtl",
      width: 512,
      height: 512,
      dpi: 300,
    });
    const workflowFile = path.join(root, "workflow.json");
    fs.writeFileSync(
      workflowFile,
      JSON.stringify({ 6: { inputs: { text: "" } } }),
    );
    const workflow = db.registerComfyWorkflow("timeout", workflowFile, {
      prompt: { nodeId: "6", input: "text" },
    })[0];
    await assert.rejects(
      () =>
        new AIService(db).generateImage({
          projectId: project.project.id,
          workflowId: workflow.id,
          prompt: "cat",
          negativePrompt: "",
        }),
      /タイムアウト/,
    );
    const job = db.listGenerationJobs(project.project.id)[0];
    assert.equal(job.status, "failed");
    assert.equal(job.errorCode, "TIMEOUT");
  } finally {
    db.close();
    await mock.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ComfyUI workflow settings can be validated, edited and defaulted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mangai-workflow-ai-")),
    paths = {
      root,
      database: path.join(root, "db.sqlite"),
      projects: path.join(root, "projects"),
      assets: path.join(root, "assets"),
      exports: path.join(root, "exports"),
      logs: path.join(root, "logs"),
    },
    db = new MangaiDatabase(paths);
  try {
    const sourceA = path.join(root, "a.json"),
      sourceB = path.join(root, "b.json");
    fs.writeFileSync(sourceA, JSON.stringify({ 6: { inputs: { text: "" } } }));
    fs.writeFileSync(
      sourceB,
      JSON.stringify({ 10: { inputs: { prompt: "" } } }),
    );
    let list = db.registerComfyWorkflow("A", sourceA, {
      prompt: { nodeId: "6", input: "text" },
    });
    assert.equal(list[0].isDefault, 1);
    assert.equal(db.validateComfyWorkflow(list[0].id).ok, true);
    const firstId = list[0].id;
    list = db.registerComfyWorkflow("B", sourceB, {
      prompt: { nodeId: "10", input: "prompt" },
    });
    const second = list.find((item) => item.name === "B");
    list = db.setDefaultComfyWorkflow(second.id);
    assert.equal(list[0].id, second.id);
    list = db.updateComfyWorkflow(second.id, "B updated", {
      prompt: { nodeId: "missing", input: "text" },
    });
    assert.equal(db.validateComfyWorkflow(second.id).ok, false);
    list = db.deleteComfyWorkflow(second.id);
    assert.equal(list[0].id, firstId);
    assert.equal(list[0].isDefault, 1);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
