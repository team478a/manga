import React from "react";
import type { ProjectBundle } from "@mangai/project-core";
import type { ChatEvent } from "../../../preload/api";
import { StatusBadge } from "../../components/common/StatusBadge";
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
  onOpenSettings,
  onClose,
}: {
  bundle: ProjectBundle;
  episodeId?: string;
  pageId?: string;
  onBundle: (value: ProjectBundle) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const [mockEnabled, setMockEnabled] = React.useState(false);
  const [sessions, setSessions] = React.useState<any[]>([]),
    [projects, setProjects] = React.useState<
      Array<{ id: string; title: string }>
    >([]),
    [chatBundle, setChatBundle] = React.useState(bundle),
    [chatEpisodeId, setChatEpisodeId] = React.useState(episodeId),
    [chatPageId, setChatPageId] = React.useState(pageId),
    [sessionId, setSessionId] = React.useState<string>(),
    [messages, setMessages] = React.useState<Message[]>([]),
    [templates, setTemplates] = React.useState<any[]>([]),
    [templateId, setTemplateId] = React.useState(""),
    [input, setInput] = React.useState(""),
    [includeContext, setIncludeContext] = React.useState(true),
    [requestId, setRequestId] = React.useState<string>(),
    [error, setError] = React.useState("");
  const loadSessions = () =>
    window.mangai.ai.listSessions(chatBundle.project.id).then(setSessions);
  React.useEffect(() => {
    void window.mangai.ai
      .runtimeInfo()
      .then((info) => setMockEnabled(info.mockEnabled));
  }, []);
  React.useEffect(() => {
    void loadSessions();
    void window.mangai.listProjects().then(setProjects);
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
  }, [requestId, chatBundle.project.id]);
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
      projectId: chatBundle.project.id,
      episodeId: chatEpisodeId,
      pageId: chatPageId,
      message: text,
      templateId: templateId || undefined,
      includeContext,
    });
  };
  const episode = chatBundle.episodes.find((e) => e.id === chatEpisodeId),
    page = chatBundle.pages.find((p) => p.id === chatPageId);
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>← ワークスペース</button>
        <h1>Creator Chat</h1>
        <StatusBadge tone={requestId ? "info" : "success"} live>
          {requestId ? "生成中" : "待機中"}
        </StatusBadge>
      </header>
      <div className="chat-layout">
        <aside>
          <label>
            Project
            <select
              value={chatBundle.project.id}
              disabled={Boolean(requestId)}
              onChange={async (e) => {
                const opened = await window.mangai.openProject(e.target.value);
                setChatBundle(opened);
                onBundle(opened);
                const nextEpisode = opened.episodes[0];
                setChatEpisodeId(nextEpisode?.id);
                setChatPageId(
                  opened.pages
                    .filter((page) => page.episodeId === nextEpisode?.id)
                    .sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id,
                );
                setSessionId(undefined);
                setMessages([]);
                setSessions(
                  await window.mangai.ai.listSessions(opened.project.id),
                );
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Episode
            <select
              value={chatEpisodeId ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                setChatEpisodeId(id);
                setChatPageId(
                  chatBundle.pages
                    .filter((page) => page.episodeId === id)
                    .sort((a, b) => a.orderIndex - b.orderIndex)[0]?.id,
                );
              }}
            >
              {chatBundle.episodes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Page
            <select
              value={chatPageId ?? ""}
              onChange={(e) => setChatPageId(e.target.value || undefined)}
            >
              <option value="">未選択</option>
              {chatBundle.pages
                .filter((item) => item.episodeId === chatEpisodeId)
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    Page {item.pageNumber}
                  </option>
                ))}
            </select>
          </label>
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
          {mockEnabled && (
            <p className="notice">テストモード: Mock AIが有効です。</p>
          )}
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
                            setChatBundle(updated);
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
          {error && (
            <div className="error">
              <p>{error}</p>
              {error.includes("AIが設定されていません") && (
                <button className="secondary" onClick={onOpenSettings}>
                  AI設定を開く
                </button>
              )}
            </div>
          )}
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
          <p>Project: {chatBundle.project.title}</p>
          <p>ジャンル: {chatBundle.project.genre || "未設定"}</p>
          <p>対象年齢: {chatBundle.project.ageRating}</p>
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
