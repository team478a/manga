import React from "react";
import type { ProjectBundle } from "@mangai/project-core";
import type { ChatEvent } from "../../../preload/api";
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};
export function CreatorChat({
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
  const [sessions, setSessions] = React.useState<any[]>([]),
    [sessionId, setSessionId] = React.useState<string>(),
    [messages, setMessages] = React.useState<Message[]>([]),
    [templates, setTemplates] = React.useState<any[]>([]),
    [templateId, setTemplateId] = React.useState(""),
    [input, setInput] = React.useState(""),
    [includeContext, setIncludeContext] = React.useState(true),
    [requestId, setRequestId] = React.useState<string>(),
    [error, setError] = React.useState("");
  const loadSessions = () =>
    window.mangai.ai.listSessions(bundle.project.id).then(setSessions);
  React.useEffect(() => {
    void loadSessions();
    void window.mangai.ai.listTemplates().then(setTemplates);
    return window.mangai.ai.onChatEvent((event: ChatEvent) => {
      if (requestId && event.requestId !== requestId) return;
      if (event.sessionId) setSessionId(event.sessionId);
      if (event.type === "chunk")
        setMessages((values) => {
          const last = values.at(-1);
          return last?.role === "assistant"
            ? [
                ...values.slice(0, -1),
                { ...last, content: last.content + (event.text ?? "") },
              ]
            : [
                ...values,
                {
                  id: `stream-${event.requestId}`,
                  role: "assistant",
                  content: event.text ?? "",
                },
              ];
        });
      if (event.type === "complete" || event.type === "canceled") {
        setRequestId(undefined);
        void loadSessions();
      }
      if (event.type === "error") {
        setError(event.message ?? "生成に失敗しました。");
        setRequestId(undefined);
      }
    });
  }, [requestId]);
  React.useEffect(() => {
    if (sessionId)
      void window.mangai.ai.listMessages(sessionId).then(setMessages);
  }, [sessionId]);
  const send = async (override?: string) => {
    const source = override ?? input;
    if (!source.trim() || requestId) return;
    const id = crypto.randomUUID(),
      text = source.trim();
    setMessages((values) => [
      ...values,
      { id: `user-${id}`, role: "user", content: text },
    ]);
    setInput("");
    setRequestId(id);
    await window.mangai.ai.sendChat({
      requestId: id,
      sessionId,
      projectId: bundle.project.id,
      episodeId,
      pageId,
      message: text,
      templateId: templateId || undefined,
      includeContext,
    });
  };
  const episode = bundle.episodes.find((e) => e.id === episodeId),
    page = bundle.pages.find((p) => p.id === pageId);
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>Creator Chat</h1>
        <span>{requestId ? "生成中" : "待機中"}</span>
      </header>
      <div className="chat-layout">
        <aside>
          <button
            className="wide"
            onClick={() => {
              setSessionId(undefined);
              setMessages([]);
            }}
          >
            ＋ 新規チャット
          </button>
          {sessions.map((session) => (
            <div
              className={`chat-session ${session.id === sessionId ? "active" : ""}`}
              key={session.id}
              onClick={() => setSessionId(session.id)}
            >
              <span>{session.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const title = prompt("セッション名", session.title);
                  if (title)
                    void window.mangai.ai
                      .renameSession(session.id, title)
                      .then(setSessions);
                }}
              >
                ✎
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("チャットを削除しますか？"))
                    void window.mangai.ai
                      .deleteSession(session.id)
                      .then((values) => {
                        setSessions(values);
                        if (session.id === sessionId) {
                          setSessionId(undefined);
                          setMessages([]);
                        }
                      });
                }}
              >
                ×
              </button>
            </div>
          ))}
        </aside>
        <section className="chat-main">
          <div className="messages">
            {messages.length ? (
              messages.map((message, index) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <b>{message.role === "user" ? "あなた" : "Creator AI"}</b>
                  <pre>{message.content}</pre>
                  {message.role === "assistant" && (
                    <div className="message-actions">
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                      >
                        コピー
                      </button>
                      <button
                        disabled={Boolean(requestId)}
                        onClick={() => {
                          const previous = [...messages.slice(0, index)]
                            .reverse()
                            .find((item) => item.role === "user");
                          if (previous) void send(previous.content);
                        }}
                      >
                        再生成
                      </button>
                      {page && (
                        <button
                          onClick={async () => {
                            const updated = await window.mangai.savePage(
                              page.id,
                              page.prompt,
                              page.negativePrompt,
                              [page.notes, message.content]
                                .filter(Boolean)
                                .join("\n\n"),
                            );
                            onBundle(updated);
                          }}
                        >
                          Pageメモへ保存
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty">
                漫画の企画、構成、セリフ、画像プロンプトなどを相談できます。
              </div>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <div className="composer">
            <div className="grid">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">テンプレートなし</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(e) => setIncludeContext(e.target.checked)}
                />
                Project情報を参照
              </label>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Creator AIへ相談する内容を入力"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void send();
              }}
            />
            <div className="inline">
              {requestId ? (
                <button
                  className="danger"
                  onClick={() => window.mangai.ai.cancel(requestId)}
                >
                  送信停止
                </button>
              ) : (
                <button onClick={() => void send()}>送信（Ctrl+Enter）</button>
              )}
              <span>Ollama有効時はOllama、未設定時はモックを使用</span>
            </div>
          </div>
        </section>
        <aside className="context-panel">
          <h2>送信コンテキスト</h2>
          <p>Project: {bundle.project.title}</p>
          <p>ジャンル: {bundle.project.genre || "未設定"}</p>
          <p>対象年齢: {bundle.project.ageRating}</p>
          <p>Episode: {episode?.title ?? "未選択"}</p>
          <p>Page: {page?.pageNumber ?? "未選択"}</p>
          {page?.prompt && <p>Prompt: {page.prompt}</p>}
          <p className="notice">
            この内容は「Project情報を参照」が有効な場合だけAIへ送信されます。
          </p>
        </aside>
      </div>
    </main>
  );
}
