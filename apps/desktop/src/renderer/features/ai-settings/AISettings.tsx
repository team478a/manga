import React from "react";
import type { ProviderSettings } from "@mangai/ai-core";

type PromptTemplate = {
  id: string;
  name: string;
  template: string;
  systemPrompt: string;
  isBuiltin: number;
};

export function AISettings({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = React.useState<ProviderSettings[]>([]),
    [models, setModels] = React.useState<
      Record<string, Array<{ id: string; name: string; cached?: boolean }>>
    >({}),
    [status, setStatus] = React.useState<Record<string, string>>({}),
    [paths, setPaths] = React.useState<any>(),
    [templates, setTemplates] = React.useState<PromptTemplate[]>([]),
    [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(
      null,
    ),
    [templateName, setTemplateName] = React.useState(""),
    [templateBody, setTemplateBody] = React.useState(""),
    [templateSystemPrompt, setTemplateSystemPrompt] = React.useState("");
  const load = () =>
    Promise.all([
      window.mangai.ai.listSettings().then(setSettings),
      window.mangai.getPaths().then(setPaths),
      window.mangai.ai.listTemplates().then(setTemplates),
    ]);
  React.useEffect(() => {
    void load();
  }, []);
  const update = (id: string, patch: Partial<ProviderSettings>) =>
    setSettings((values) =>
      values.map((value) =>
        value.providerId === id ? { ...value, ...patch } : value,
      ),
    );
  const save = async (value: ProviderSettings) => {
    await window.mangai.ai.saveSettings(value);
    setStatus((s) => ({ ...s, [value.providerId]: "保存しました。" }));
  };
  const check = async (value: ProviderSettings) => {
    await save(value);
    setStatus((s) => ({ ...s, [value.providerId]: "接続確認中…" }));
    try {
      const result = await window.mangai.ai.checkProvider(value.providerId);
      setStatus((s) => ({ ...s, [value.providerId]: result.message }));
      if (result.ok && value.providerId !== "comfyui")
        setModels((m) => ({ ...m, [value.providerId]: [] }));
    } catch (error) {
      setStatus((s) => ({
        ...s,
        [value.providerId]:
          error instanceof Error ? error.message : String(error),
      }));
    }
  };
  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateBody("");
    setTemplateSystemPrompt("");
  };
  const fillTemplateForm = (template: PromptTemplate, duplicate: boolean) => {
    setEditingTemplateId(duplicate ? null : template.id);
    setTemplateName(duplicate ? `${template.name} のコピー` : template.name);
    setTemplateBody(template.template);
    setTemplateSystemPrompt(template.systemPrompt);
  };
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>AI設定</h1>
      </header>
      <div className="tool-content">
        <section className="panel-lite">
          <h2>一般設定</h2>
          <p>データ保存先: {paths?.root ?? "読み込み中"}</p>
          <p>AIログには秘密情報を保存しません。クラウドAPIキーは未対応です。</p>
        </section>
        {settings.map((value) => (
          <section className="panel-lite" key={value.providerId}>
            <div className="setting-title">
              <h2>
                {value.providerId === "ollama"
                  ? "Ollama"
                  : value.providerId === "comfyui"
                    ? "ComfyUI"
                    : "モックプロバイダー"}
              </h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={value.enabled}
                  onChange={(e) =>
                    update(value.providerId, { enabled: e.target.checked })
                  }
                />
                有効
              </label>
            </div>
            <label>
              接続URL
              <input
                value={value.baseUrl}
                onChange={(e) =>
                  update(value.providerId, { baseUrl: e.target.value })
                }
              />
            </label>
            {value.providerId !== "comfyui" && (
              <>
                <label>
                  使用モデル
                  <select
                    value={value.modelId}
                    onChange={(e) =>
                      update(value.providerId, { modelId: e.target.value })
                    }
                  >
                    <option value="">選択してください</option>
                    {models[value.providerId]?.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid">
                  <label>
                    Temperature
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={value.temperature}
                      onChange={(e) =>
                        update(value.providerId, {
                          temperature: +e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    最大出力
                    <input
                      type="number"
                      value={value.maxTokens}
                      onChange={(e) =>
                        update(value.providerId, { maxTokens: +e.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={value.stream}
                    onChange={(e) =>
                      update(value.providerId, { stream: e.target.checked })
                    }
                  />
                  ストリーミング
                </label>
              </>
            )}
            <div className="grid">
              <label>
                タイムアウト(ms)
                <input
                  type="number"
                  value={value.timeoutMs}
                  onChange={(e) =>
                    update(value.providerId, { timeoutMs: +e.target.value })
                  }
                />
              </label>
              {value.providerId === "comfyui" && (
                <label>
                  ポーリング間隔(ms)
                  <input
                    type="number"
                    value={value.pollIntervalMs}
                    onChange={(e) =>
                      update(value.providerId, {
                        pollIntervalMs: +e.target.value,
                      })
                    }
                  />
                </label>
              )}
            </div>
            <div className="inline">
              <button onClick={() => save(value)}>保存</button>
              <button className="secondary" onClick={() => check(value)}>
                接続確認
              </button>
              {value.providerId !== "comfyui" && (
                <button
                  className="secondary"
                  onClick={async () => {
                    await save(value);
                    const list = await window.mangai.ai.listModels(
                      value.providerId,
                    );
                    setModels((m) => ({ ...m, [value.providerId]: list }));
                    setStatus((s) => ({
                      ...s,
                      [value.providerId]: `${list.length}件のモデルを取得しました。${list.some((model) => model.cached) ? "（前回取得したキャッシュ）" : ""}`,
                    }));
                  }}
                >
                  モデル一覧更新
                </button>
              )}
            </div>
            {status[value.providerId] && (
              <p className="notice">{status[value.providerId]}</p>
            )}
          </section>
        ))}
        <section className="panel-lite">
          <h2>プロンプトテンプレート</h2>
          <p>
            初期テンプレートを複製するか、Creator
            Chat用テンプレートを追加・編集できます。
          </p>
          <div className="grid">
            <label>
              名前
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </label>
            <label>
              テンプレート
              <textarea
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
              />
            </label>
            <label>
              システムプロンプト（任意）
              <textarea
                value={templateSystemPrompt}
                onChange={(e) => setTemplateSystemPrompt(e.target.value)}
              />
            </label>
          </div>
          <div className="inline">
            <button
              disabled={!templateName.trim() || !templateBody.trim()}
              onClick={async () => {
                setTemplates(
                  await window.mangai.ai.saveTemplate({
                    id: editingTemplateId ?? undefined,
                    name: templateName,
                    template: templateBody,
                    systemPrompt: templateSystemPrompt,
                  }),
                );
                resetTemplateForm();
              }}
            >
              {editingTemplateId ? "変更を保存" : "追加"}
            </button>
            {editingTemplateId && (
              <button className="secondary" onClick={resetTemplateForm}>
                編集をキャンセル
              </button>
            )}
          </div>
          <div className="job-list">
            {templates.map((template) => (
              <article key={template.id}>
                <div>
                  <b>
                    {template.name} {template.isBuiltin ? "（初期）" : ""}
                  </b>
                  <p>{template.template}</p>
                  {template.systemPrompt && (
                    <p>システム: {template.systemPrompt}</p>
                  )}
                </div>
                <div className="inline">
                  <button
                    className="secondary"
                    onClick={() => fillTemplateForm(template, true)}
                  >
                    複製
                  </button>
                  {!template.isBuiltin && (
                    <>
                      <button
                        className="secondary"
                        onClick={() => fillTemplateForm(template, false)}
                      >
                        編集
                      </button>
                      <button
                        className="danger"
                        onClick={async () => {
                          setTemplates(
                            await window.mangai.ai.deleteTemplate(template.id),
                          );
                          if (editingTemplateId === template.id)
                            resetTemplateForm();
                        }}
                      >
                        削除
                      </button>
                    </>
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
