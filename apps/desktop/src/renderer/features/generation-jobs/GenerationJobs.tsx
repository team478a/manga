import React from "react";
import type { ProjectBundle } from "@mangai/project-core";
export function GenerationJobs({
  bundle,
  episodeId,
  pageId,
  onBundle,
  onClose,
}: {
  bundle: ProjectBundle;
  episodeId?: string;
  pageId?: string;
  onBundle: (value: ProjectBundle) => void;
  onClose: () => void;
}) {
  const [jobs, setJobs] = React.useState<any[]>([]),
    [workflows, setWorkflows] = React.useState<any[]>([]),
    [workflowId, setWorkflowId] = React.useState(""),
    [promptText, setPrompt] = React.useState(""),
    [negative, setNegative] = React.useState(""),
    [busy, setBusy] = React.useState(false),
    [error, setError] = React.useState(""),
    [workflowMessage, setWorkflowMessage] = React.useState("");
  const load = () =>
    Promise.all([
      window.mangai.ai.listJobs(bundle.project.id).then(setJobs),
      window.mangai.ai.listWorkflows().then(setWorkflows),
    ]);
  React.useEffect(() => {
    void load();
  }, []);
  const generate = async () => {
    if (!workflowId || !promptText.trim()) return;
    setBusy(true);
    setError("");
    const refreshTimer = window.setInterval(() => void load(), 750);
    try {
      const result = await window.mangai.ai.generateImage({
        projectId: bundle.project.id,
        episodeId,
        pageId,
        workflowId,
        prompt: promptText,
        negativePrompt: negative,
        width: bundle.project.width,
        height: bundle.project.height,
        seed: Math.floor(Math.random() * 2147483647),
      });
      if (result.bundle) onBundle(result.bundle);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      await load();
    } finally {
      window.clearInterval(refreshTimer);
      setBusy(false);
    }
  };
  const selectedWorkflow = workflows.find(
    (workflow) => workflow.id === workflowId,
  );
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>AI生成ジョブ</h1>
      </header>
      <div className="tool-content">
        <section className="panel-lite">
          <h2>ComfyUI画像生成</h2>
          <div className="inline">
            <select
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
            >
              <option value="">ワークフローを選択</option>
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.isDefault ? "★ " : ""}
                  {w.name}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              onClick={async () => {
                const name = prompt("ワークフロー名", "標準ワークフロー");
                if (name) {
                  const mappingText = prompt(
                    "入力マッピングJSONを指定してください。ノードIDはワークフローに合わせて変更します。",
                    '{"prompt":{"nodeId":"6","input":"text"},"negativePrompt":{"nodeId":"7","input":"text"},"width":{"nodeId":"5","input":"width"},"height":{"nodeId":"5","input":"height"},"seed":{"nodeId":"3","input":"seed"}}',
                  );
                  if (mappingText)
                    try {
                      setWorkflows(
                        await window.mangai.ai.addWorkflow(
                          name,
                          JSON.parse(mappingText),
                        ),
                      );
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : String(cause),
                      );
                    }
                }
              }}
            >
              JSON追加
            </button>
            <button
              className="danger"
              disabled={!workflowId}
              onClick={async () => {
                if (confirm("選択中のワークフロー設定を削除しますか？")) {
                  setWorkflows(
                    await window.mangai.ai.deleteWorkflow(workflowId),
                  );
                  setWorkflowId("");
                }
              }}
            >
              設定削除
            </button>
          </div>
          {selectedWorkflow && (
            <div className="workflow-tools">
              <p>
                入力マッピング: <code>{selectedWorkflow.mappingJson}</code>
              </p>
              <div className="inline">
                <button
                  className="secondary"
                  onClick={async () => {
                    const name = prompt(
                      "ワークフロー名",
                      selectedWorkflow.name,
                    );
                    if (!name) return;
                    const mappingText = prompt(
                      "入力マッピングJSON",
                      selectedWorkflow.mappingJson,
                    );
                    if (!mappingText) return;
                    try {
                      setWorkflows(
                        await window.mangai.ai.updateWorkflow(
                          selectedWorkflow.id,
                          name,
                          JSON.parse(mappingText),
                        ),
                      );
                      setWorkflowMessage("ワークフロー設定を更新しました。");
                    } catch (cause) {
                      setError(
                        cause instanceof Error ? cause.message : String(cause),
                      );
                    }
                  }}
                >
                  名前・マッピング編集
                </button>
                <button
                  className="secondary"
                  disabled={Boolean(selectedWorkflow.isDefault)}
                  onClick={async () => {
                    setWorkflows(
                      await window.mangai.ai.setDefaultWorkflow(
                        selectedWorkflow.id,
                      ),
                    );
                    setWorkflowMessage("既定ワークフローに設定しました。");
                  }}
                >
                  既定に設定
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const result = await window.mangai.ai.validateWorkflow(
                      selectedWorkflow.id,
                    );
                    setWorkflowMessage(result.message);
                  }}
                >
                  マッピング検証
                </button>
                <button
                  className="secondary"
                  onClick={async () => {
                    const result = await window.mangai.ai.testWorkflow(
                      selectedWorkflow.id,
                    );
                    setWorkflowMessage(result.message);
                  }}
                >
                  接続テスト
                </button>
              </div>
            </div>
          )}
          {workflowMessage && <p className="notice">{workflowMessage}</p>}
          <label>
            Prompt
            <textarea
              value={promptText}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <label>
            Negative Prompt
            <textarea
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
            />
          </label>
          <button
            disabled={busy || !workflowId || !promptText.trim()}
            onClick={() => void generate()}
          >
            {busy ? "生成中…" : "画像生成を開始"}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
        <section className="panel-lite">
          <h2>生成履歴</h2>
          <div className="job-list">
            {jobs.map((job) => (
              <article key={job.id}>
                <div>
                  <b>
                    {job.generationType} / {job.providerId}
                  </b>
                  <p>{job.prompt}</p>
                  <small>
                    {job.status}・{job.createdAt}
                  </small>
                  {job.errorMessage && (
                    <p className="error">{job.errorMessage}</p>
                  )}
                </div>
                <div className="inline">
                  {job.status === "completed" &&
                    job.generationType === "image" && (
                      <button className="secondary" onClick={onClose}>
                        素材を開く
                      </button>
                    )}
                  {job.status === "running" && (
                    <button
                      className="danger"
                      onClick={() => window.mangai.ai.cancel(job.id).then(load)}
                    >
                      キャンセル
                    </button>
                  )}
                  {job.status === "failed" &&
                    job.generationType === "image" && (
                      <button
                        onClick={async () => {
                          const input = JSON.parse(job.inputJson);
                          setBusy(true);
                          try {
                            const result =
                              await window.mangai.ai.generateImage(input);
                            if (result.bundle) onBundle(result.bundle);
                            await load();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        再実行
                      </button>
                    )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
