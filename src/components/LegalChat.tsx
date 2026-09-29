import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RecordsDashboard } from "@/components/RecordsDashboard";
import { LegalLibrary } from "@/components/LegalLibrary";
import { getToken } from "@/lib/api-client";

type Source = { act: string; section: string; title: string; source: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const STORAGE_KEY = "nyaya-sahayak-conversations";

const SUGGESTIONS = [
  "My landlord is not returning my security deposit.",
  "An online seller refuses to refund a defective phone.",
  "The police station refused to register my FIR.",
  "My employer has not paid my salary for two months.",
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Namaste. Describe your situation in your own words — for example a problem with a landlord, a shopkeeper, your employer, or a government office. I will explain what Indian law says and the practical steps you can take.",
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const DEVICE_KEY = "nyaya-sahayak-device";

/** Headers identifying the chat owner: login token if signed in, else an anonymous device id. */
function chatHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    let device = localStorage.getItem(DEVICE_KEY);
    if (!device) {
      device = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(DEVICE_KEY, device);
    }
    headers["X-Device-Id"] = device;
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* storage unavailable */
  }
  return headers;
}

function makeConversation(): Conversation {
  return { id: newId(), title: "New chat", messages: [WELCOME], updatedAt: Date.now() };
}

function groupLabel(ts: number) {
  const day = 86400000;
  const diff = Date.now() - ts;
  if (diff < day) return "Today";
  if (diff < 2 * day) return "Yesterday";
  if (diff < 7 * day) return "Previous 7 days";
  return "Older";
}

export function LegalChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [view, setView] = useState<"chat" | "mychats" | "library" | "records">("chat");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Last JSON saved to MongoDB per chat, so only changed chats are re-sent.
  const syncedRef = useRef<Record<string, string>>({});

  // Load chats from MongoDB (falls back to this browser's copy if offline).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: Conversation[] = [];
      try {
        const res = await fetch("/api/conversations", { headers: chatHeaders() });
        if (!res.ok) throw new Error("load failed");
        const data = (await res.json()) as { conversations: Conversation[] };
        loaded = data.conversations;
        for (const c of loaded) syncedRef.current[c.id] = JSON.stringify(c);
      } catch {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) loaded = JSON.parse(raw) as Conversation[];
        } catch {
          loaded = [];
        }
      }
      if (cancelled) return;
      if (!loaded.length) loaded = [makeConversation()];
      loaded.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(loaded);
      setActiveId(loaded[0].id);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Save changed chats (messages + AI answers) to MongoDB and a local backup.
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {
      /* storage unavailable */
    }
    const timer = setTimeout(() => {
      for (const c of conversations) {
        if (c.messages.length <= 1) continue; // skip empty "New chat"
        const json = JSON.stringify(c);
        if (syncedRef.current[c.id] === json) continue;
        syncedRef.current[c.id] = json;
        void fetch(`/api/conversations/${encodeURIComponent(c.id)}`, {
          method: "PUT",
          headers: { ...chatHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ title: c.title, messages: c.messages, updatedAt: c.updatedAt }),
        }).catch(() => {
          delete syncedRef.current[c.id];
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [conversations, hydrated]);

  const active = conversations.find((c) => c.id === activeId);
  const messages = active?.messages ?? [WELCOME];
  const isLoading = loadingId === activeId;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const updateConversation = (id: string, fn: (c: Conversation) => Conversation) =>
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || loadingId || !active) return;
      const convId = active.id;

      setError(null);
      setInput("");
      const userMessage: Message = { id: newId(), role: "user", content: question };
      const history = [...active.messages, userMessage];
      updateConversation(convId, (c) => ({
        ...c,
        title: c.title === "New chat" ? question.slice(0, 48) : c.title,
        messages: history,
        updatedAt: Date.now(),
      }));
      setLoadingId(convId);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history
              .filter((m) => m.id !== "welcome")
              .map(({ role, content }) => ({ role, content })),
          }),
        });
        const data = (await response.json()) as { reply?: string; sources?: Source[]; error?: string };
        if (!response.ok || !data.reply) {
          setError(data.error ?? "Something went wrong. Please try again.");
          return;
        }
        updateConversation(convId, (c) => ({
          ...c,
          messages: [
            ...c.messages,
            { id: newId(), role: "assistant", content: data.reply as string, sources: data.sources },
          ],
          updatedAt: Date.now(),
        }));
      } catch {
        setError("Could not reach the assistant. Please check your connection and try again.");
      } finally {
        setLoadingId(null);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [active, loadingId],
  );

  function newChat() {
    const empty = conversations.find((c) => c.messages.length === 1);
    if (empty) {
      setActiveId(empty.id);
    } else {
      const conv = makeConversation();
      setConversations((prev) => [conv, ...prev]);
      setActiveId(conv.id);
    }
    setInput("");
    setError(null);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  function selectChat(id: string) {
    setActiveId(id);
    setView("chat");
    setError(null);
    setSidebarOpen(false);
  }

  function deleteChat(id: string) {
    const rest = conversations.filter((c) => c.id !== id);
    const next = rest.length ? rest : [makeConversation()];
    setConversations(next);
    if (id === activeId) setActiveId(next[0].id);
    delete syncedRef.current[id];
    void fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: chatHeaders(),
    }).catch(() => {});
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) {
      updateConversation(renamingId, (c) => ({ ...c, title: renameValue.trim() }));
    }
    setRenamingId(null);
  }

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  const groups: Array<[string, Conversation[]]> = [];
  for (const c of sorted) {
    const label = groupLabel(c.updatedAt);
    const g = groups.find(([l]) => l === label);
    if (g) g[1].push(c);
    else groups.push([label, [c]]);
  }

  return (
    <div className="relative flex h-dvh w-full overflow-hidden bg-card">
      {/* Sidebar */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close chats"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-10 bg-background/70 md:hidden"
        />
      )}
      <aside
        className={`absolute inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 pb-1 pt-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">
            NS
          </span>
          <span className="text-sm font-extrabold tracking-tight">Nyaya Sahayak</span>
        </div>
        <div className="grid grid-cols-2 gap-1 px-3 pb-2">
          {(
            [
              ["chat", "Assistant"],
              ["mychats", "My Chats"],
              ["library", "Legal Docs"],
              ["records", "Case Records"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setView(key);
                setSidebarOpen(false);
              }}
              className={`rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                view === key
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={newChat}
            className="flex w-full items-center gap-2 rounded-xl border border-primary/40 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <span className="text-lg leading-none">+</span> New chat
          </button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map((c) => (
                  <li key={c.id} className="group relative">
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className="w-full rounded-lg border border-primary/50 bg-background px-2 py-2 text-xs text-foreground outline-none"
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => selectChat(c.id)}
                          className={`w-full truncate rounded-lg px-2 py-2 pr-14 text-left text-xs transition-colors ${
                            c.id === activeId
                              ? "bg-primary/15 text-foreground"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          {c.title}
                        </button>
                        <div className="absolute right-1 top-1/2 hidden -translate-y-1/2 gap-0.5 group-hover:flex">
                          <button
                            type="button"
                            aria-label="Rename chat"
                            onClick={() => {
                              setRenamingId(c.id);
                              setRenameValue(c.title);
                            }}
                            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-primary"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            aria-label="Delete chat"
                            onClick={() => deleteChat(c.id)}
                            className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-destructive"
                          >
                            ✕
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      {view === "records" ? (
        <RecordsDashboard />
      ) : view === "library" ? (
        <LegalLibrary
          onMenu={() => setSidebarOpen(true)}
          onAsk={(q) => {
            newChat();
            setView("chat");
            setInput(q);
          }}
        />
      ) : view === "mychats" ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-border bg-surface-raised/50 px-4 py-3 sm:px-6">
            <button type="button" aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground md:hidden">☰</button>
            <div>
              <p className="text-sm font-bold">My Chats</p>
              <p className="text-[11px] text-muted-foreground">Saved in the database — open them on any device after logging in</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6">
              {sorted.filter((c) => c.messages.length > 1).length === 0 && (
                <p className="text-sm text-muted-foreground">No saved chats yet. Ask the assistant a question to start one.</p>
              )}
              {sorted
                .filter((c) => c.messages.length > 1)
                .map((c) => {
                  const last = [...c.messages].reverse().find((m) => m.role === "assistant");
                  return (
                    <div key={c.id} className="rounded-2xl border border-border bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <button type="button" onClick={() => selectChat(c.id)} className="min-w-0 text-left">
                          <p className="truncate text-sm font-bold hover:text-primary">{c.title}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {c.messages.filter((m) => m.role === "user").length} questions · {new Date(c.updatedAt).toLocaleString()}
                          </p>
                        </button>
                        <button type="button" aria-label="Delete chat" onClick={() => deleteChat(c.id)} className="text-xs text-muted-foreground hover:text-destructive">✕</button>
                      </div>
                      {last && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{last.content.replace(/[#*_`>]/g, "")}</p>}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : (
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-raised/50 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open chats"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg border border-border px-2 py-1 text-sm text-muted-foreground md:hidden"
            >
              ☰
            </button>
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold tracking-tight">{active?.title ?? "Nyaya Sahayak"}</h3>
              <p className="text-[11px] text-muted-foreground">Grounded in official Indian legal sources</p>
            </div>
          </div>
          <button
            type="button"
            onClick={newChat}
            className="shrink-0 rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            New conversation
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-5">
          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm font-medium text-primary-foreground sm:max-w-[75%]">
                  {message.content}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-xs font-extrabold text-primary">
                  NS
                </div>
                <div className="max-w-[92%] space-y-3 sm:max-w-[85%]">
                  <div className="answer-body rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                  </div>
                  {message.sources && message.sources.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-border bg-secondary px-4 py-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Sources referred to</p>
                      <ul className="space-y-1.5">
                        {message.sources.map((source) => (
                          <li key={source.source + source.section} className="text-[11px] text-muted-foreground">
                            <a
                              href={source.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-secondary-foreground underline-offset-2 hover:text-primary hover:underline"
                            >
                              {source.act}
                            </a>
                            {" — "}
                            {source.section}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {isLoading && (
            <div className="flex gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-xs font-extrabold text-primary">
                NS
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-surface px-4 py-4">
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-primary" />
                <span className="ml-2 text-xs text-muted-foreground">Looking up the law…</span>
              </div>
            </div>
          )}
          </div>
        </div>

        {messages.length === 1 && !isLoading && (
          <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2 border-t border-border px-4 pt-4 sm:px-6">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void send(suggestion)}
                className="rounded-full border border-border bg-secondary px-3.5 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl space-y-3 border-t border-border px-4 py-4 sm:px-6">
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
              {error}
            </p>
          )}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-2 rounded-2xl border border-input bg-background p-2 focus-within:border-primary/50"
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              rows={2}
              placeholder="Describe your situation… e.g. My landlord is not returning my security deposit."
              className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!!loadingId || input.trim().length === 0}
              className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>
          <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-bold text-primary">Disclaimer: </span>
            This AI provides legal information only, not legal advice. Always consult a qualified legal
            professional for your specific situation.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}
