import React from "react";
import type { ProjectBundle } from "@mangai/project-core";
import type { ChatEvent } from "../../../preload/api";
import { StatusBadge } from "../../components/common/StatusBadge";
import { useI18n } from "../../i18n";
type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};
export function CreatorChat({
  variant = "page",
  bundle,
  episodeId,
  pageId,
  onBundle,
  onOpenSettings,
  onClose,
}: {
  variant?: "page" | "panel";
  bundle: ProjectBundle;
  episodeId?: string;
  pageId?: string;
  onBundle: (value: ProjectBundle) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
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
        setError(event.message ?? t("chat.failed"));
        setRequestId(undefined);
      }
    });
  }, [requestId, chatBundle.project.id, t]);
  React.useEffect(() => {
    if (sessionId)
      void window.mangai.ai.listMessages(sessionId).then(setMessages);
  }, [sessionId]);
  React.useEffect(() => {
    if (bundle.project.id !== chatBundle.project.id) {
      setSessionId(undefined);
      setMessages([]);
    }
    setChatBundle(bundle);
  }, [bundle]);
  React.useEffect(() => {
    setChatEpisodeId(episodeId);
    setChatPageId(pageId);
  }, [episodeId, pageId]);
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
  const needsAISettings =
    error.includes("AIが設定されていません") ||
    error.toLowerCase().includes("ai is not configured");
  const ageRatingLabel =
    chatBundle.project.ageRating === "全年齢"
      ? t("projectDialog.allAges")
      : chatBundle.project.ageRating === "12歳以上"
        ? t("projectDialog.age12")
        : chatBundle.project.ageRating === "15歳以上"
          ? t("projectDialog.age15")
          : t("projectDialog.adult");
  if (variant === "panel")
    return (
      <section className="creator-chat-panel" aria-label="Creator Chat">
        <header>
          <div>
            <strong>Creator Chat</strong>
            <small>
              {episode?.title ?? t("chat.noEpisode")} / Page{" "}
              {page?.pageNumber ?? t("chat.notSelected")}
            </small>
          </div>
          <StatusBadge tone={requestId ? "info" : "success"} live>
            {requestId ? t("chat.generating") : t("chat.idle")}
          </StatusBadge>
        </header>
        <div className="chat-panel-actions">
          <select
            aria-label={t("chat.history")}
            value={sessionId ?? ""}
            onChange={(event) => {
              setSessionId(event.target.value || undefined);
              if (!event.target.value) setMessages([]);
            }}
          >
            <option value="">{t("chat.new")}</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={onOpenSettings}>
            {t("chat.aiSettings")}
          </button>
        </div>
        {mockEnabled && <p className="notice">{t("chat.mockMode")}</p>}
        <div className="messages chat-panel-messages">
          {messages.length ? (
            messages.map((message, index) => (
              <article className={`message ${message.role}`} key={message.id}>
                <b>{message.role === "user" ? t("chat.you") : "Creator AI"}</b>
                <pre>{message.content}</pre>
                {message.role === "assistant" && (
                  <div className="message-actions">
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(message.content)
                      }
                    >
                      {t("chat.copy")}
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
                      {t("chat.regenerate")}
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
                        {t("chat.saveNotes")}
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="empty">{t("chat.panelEmpty")}</div>
          )}
        </div>
        {error && (
          <div className="error" role="alert">
            <p>{error}</p>
            {needsAISettings && (
              <button className="secondary" onClick={onOpenSettings}>
                {t("chat.openSettings")}
              </button>
            )}
          </div>
        )}
        <div className="composer chat-panel-composer">
          <select
            aria-label={t("chat.template")}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="">{t("chat.noTemplate")}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
          <label className="check">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(event) => setIncludeContext(event.target.checked)}
            />
            {t("chat.includeProjectPage")}
          </label>
          <textarea
            aria-label={t("chat.placeholder")}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t("chat.placeholder")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey))
                void send();
            }}
          />
          {requestId ? (
            <button
              className="danger"
              onClick={() => window.mangai.ai.cancel(requestId)}
            >
              {t("chat.stop")}
            </button>
          ) : (
            <button onClick={() => void send()}>{t("chat.send")}</button>
          )}
        </div>
      </section>
    );
  return (
    <main className="tool-page">
      <header className="tool-header">
        <button onClick={onClose}>{t("chat.backWorkspace")}</button>
        <h1>Creator Chat</h1>
        <StatusBadge tone={requestId ? "info" : "success"} live>
          {requestId ? t("chat.generating") : t("chat.idle")}
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
              <option value="">{t("chat.notSelected")}</option>
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
            {t("chat.newWithPlus")}
          </button>
          {sessions.map((session) => (
            <div
              className={`chat-session ${session.id === sessionId ? "active" : ""}`}
              key={session.id}
            >
              <button
                className="chat-session-select"
                aria-pressed={session.id === sessionId}
                onClick={() => setSessionId(session.id)}
              >
                {session.title}
              </button>
              <button
                aria-label={t("chat.renameSession", { title: session.title })}
                onClick={() => {
                  const title = prompt(t("chat.sessionName"), session.title);
                  if (title)
                    void window.mangai.ai
                      .renameSession(session.id, title)
                      .then(setSessions);
                }}
              >
                ✎
              </button>
              <button
                aria-label={t("chat.deleteSession", { title: session.title })}
                onClick={() => {
                  if (confirm(t("chat.deleteConfirm")))
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
          {mockEnabled && <p className="notice">{t("chat.mockModeFull")}</p>}
          <div className="messages">
            {messages.length ? (
              messages.map((message, index) => (
                <article className={`message ${message.role}`} key={message.id}>
                  <b>
                    {message.role === "user" ? t("chat.you") : "Creator AI"}
                  </b>
                  <pre>{message.content}</pre>
                  {message.role === "assistant" && (
                    <div className="message-actions">
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(message.content)
                        }
                      >
                        {t("chat.copy")}
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
                        {t("chat.regenerate")}
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
                          {t("chat.savePageNotes")}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty">{t("chat.fullEmpty")}</div>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
              {needsAISettings && (
                <button className="secondary" onClick={onOpenSettings}>
                  {t("chat.openSettings")}
                </button>
              )}
            </div>
          )}
          <div className="composer">
            <div className="grid">
              <select
                aria-label={t("chat.template")}
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
              >
                <option value="">{t("chat.noTemplate")}</option>
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
                {t("chat.includeProject")}
              </label>
            </div>
            <textarea
              aria-label={t("chat.placeholderFull")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("chat.placeholderFull")}
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
                  {t("chat.stop")}
                </button>
              ) : (
                <button onClick={() => void send()}>{t("chat.send")}</button>
              )}
              <span>{t("chat.providerHelp")}</span>
            </div>
          </div>
        </section>
        <aside className="context-panel">
          <h2>{t("chat.context")}</h2>
          <p>Project: {chatBundle.project.title}</p>
          <p>
            {t("chat.genre")}: {chatBundle.project.genre || t("chat.notSet")}
          </p>
          <p>
            {t("chat.ageRating")}: {ageRatingLabel}
          </p>
          <p>Episode: {episode?.title ?? t("chat.notSelected")}</p>
          <p>Page: {page?.pageNumber ?? t("chat.notSelected")}</p>
          {page?.prompt && <p>Prompt: {page.prompt}</p>}
          <p className="notice">{t("chat.contextNotice")}</p>
        </aside>
      </div>
    </main>
  );
}
