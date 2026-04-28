import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { MESSAGES_UPDATED_EVENT } from "@/hooks/useUnreadMessagesCount";
import {
  Send, Search, ArrowLeft, MessageSquare,
  Check, CheckCheck,
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";

type Conversation = {
  id: number;
  other_id: number;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  content: string;
  created_at: string;
  read_at: string | null;
};

type Message = {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  created_at: string;
  read_at: string | null;
};

/** Smart Messenger-style timestamp */
function msgTimestamp(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Day separator label */
function dayLabel(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

export default function Messages() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialUser = searchParams.get("user");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(initialUser ? Number(initialUser) : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const user = getAuthUser();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Fetch conversations (never hidden, always show all) ──────────────
  const fetchConversations = async () => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>("/api/messages");
      // Sort: unread first, then by recency — never remove any conv
      setConversations(data.conversations);
      window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT));
    } catch {
      // silent – keep existing
    } finally {
      setLoading(false);
    }
  };

  // ── Fetch message history ────────────────────────────────────────────
  const fetchMessages = async (userId: number) => {
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/api/messages/${userId}`);
      setMessages(data.messages);
      await fetchConversations();
      window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT));
    } catch {
      // keep existing
    }
  };

  // ── Auto-scroll to bottom ────────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Poll conversations every 10 s ────────────────────────────────────
  useEffect(() => {
    fetchConversations();
    const iv = setInterval(fetchConversations, 10_000);
    return () => clearInterval(iv);
  }, []);

  // ── Poll active chat every 4 s ───────────────────────────────────────
  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    const iv = setInterval(() => fetchMessages(selectedId), 4_000);
    return () => clearInterval(iv);
  }, [selectedId]);

  const sendMessage = async () => {
    if (!selectedId || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    // Optimistic insert
    const optimistic: Message = {
      id: Date.now(),
      sender_id: user?.id ?? 0,
      receiver_id: selectedId,
      content: text,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await apiFetch<{ message: Message }>("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedId, content: text }),
      });
      // Replace optimistic with real
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.message : m)));
      await fetchConversations();
      window.dispatchEvent(new Event(MESSAGES_UPDATED_EVENT));
    } catch {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInputText(text);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const activeChat = conversations.find((c) => c.other_id === selectedId);
  const activeName = activeChat?.full_name || activeChat?.username || "Chat";

  const filteredConvs = search.trim()
    ? conversations.filter((c) => {
        const name = (c.full_name || c.username || "").toLowerCase();
        return name.includes(search.trim().toLowerCase());
      })
    : conversations;

  // ── Group messages by day ────────────────────────────────────────────
  type DayGroup = { dayKey: string; label: string; messages: Message[] };
  const dayGroups: DayGroup[] = [];
  for (const m of messages) {
    const dayKey = new Date(m.created_at).toDateString();
    if (!dayGroups.length || dayGroups[dayGroups.length - 1].dayKey !== dayKey) {
      dayGroups.push({ dayKey, label: dayLabel(m.created_at), messages: [m] });
    } else {
      dayGroups[dayGroups.length - 1].messages.push(m);
    }
  }

  return (
    <div className="theme-light min-h-screen bg-background flex flex-col">
      <Header />

      <div className="flex-1 flex overflow-hidden border-t border-border" style={{ height: "calc(100vh - 65px)" }}>

        {/* ── Inbox sidebar ─────────────────────────────────────────────── */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col overflow-hidden ${
            selectedId ? "hidden md:flex" : "flex"
          }`}
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-foreground">Messages</h2>
              {conversations.filter((c) => !c.read_at).length > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-white text-[10px] font-bold">
                  {conversations.filter((c) => !c.read_at).length}
                </span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background text-foreground border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Conversation list – always shows ALL conversations */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
            ) : filteredConvs.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">
                {search ? "No conversations match" : "No messages yet. Go to Members to start a chat!"}
              </div>
            ) : (
              filteredConvs.map((c) => {
                const name = c.full_name || c.username;
                const isActive = selectedId === c.other_id;
                const isUnread = !c.read_at;
                return (
                  <div
                    key={c.other_id}
                    onClick={() => setSelectedId(c.other_id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/40 last:border-0 ${
                      isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <Avatar seed={name} name={name} src={c.avatar_url} className="h-12 w-12" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${isUnread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                          {name}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-2 flex-shrink-0">
                          {msgTimestamp(c.created_at)}
                        </span>
                      </div>
                      <div className={`text-xs truncate mt-0.5 ${isUnread ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {c.content}
                      </div>
                    </div>
                    {isUnread && (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Chat panel ────────────────────────────────────────────────── */}
        <div className={`flex-1 flex flex-col bg-background ${selectedId ? "flex" : "hidden md:flex"}`}>
          {selectedId ? (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-border bg-card flex items-center gap-3 shadow-sm">
                <button
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-2 -ml-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <Avatar
                  seed={activeName}
                  name={activeName}
                  src={activeChat?.avatar_url}
                  className="h-10 w-10"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{activeName}</div>
                  <div className="text-[10px] text-emerald-500 font-medium">Active</div>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar bg-slate-50/30 dark:bg-muted/10">
                {dayGroups.map((group) => (
                  <div key={group.dayKey}>
                    {/* Day separator */}
                    <div className="flex justify-center my-4">
                      <span className="bg-white dark:bg-card border border-border px-3 py-0.5 rounded-full text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shadow-sm">
                        {group.label}
                      </span>
                    </div>

                    {group.messages.map((m, idx) => {
                      const isMe = m.sender_id === user?.id;
                      const prevMsg = group.messages[idx - 1];
                      const nextMsg = group.messages[idx + 1];
                      const showTime = !nextMsg || (new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime()) > 60_000;
                      // Bubble shape: group consecutive from same sender
                      const isFirstInGroup = !prevMsg || prevMsg.sender_id !== m.sender_id;
                      const isLastInGroup = !nextMsg || nextMsg.sender_id !== m.sender_id;

                      return (
                        <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} ${isFirstInGroup ? "mt-3" : "mt-0.5"}`}>
                          <div className={`max-w-[78%] sm:max-w-[65%] px-3.5 py-2 text-sm shadow-sm ${
                            isMe
                              ? `bg-primary text-white ${isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg"} rounded-bl-2xl ${isLastInGroup ? "rounded-br-sm" : "rounded-br-2xl"}`
                              : `bg-white dark:bg-card border border-border/60 text-foreground ${isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg"} rounded-br-2xl ${isLastInGroup ? "rounded-bl-sm" : "rounded-bl-2xl"}`
                          }`}>
                            <span className="whitespace-pre-wrap break-words">{m.content}</span>
                          </div>
                          {showTime && (
                            <div className={`flex items-center gap-1 mt-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isMe && (
                                m.read_at
                                  ? <CheckCheck className="h-3 w-3 text-primary" />
                                  : <Check className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {messages.length === 0 && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-muted-foreground">
                      <div className="text-3xl mb-2">👋</div>
                      <div className="text-sm font-medium">Say hello to {activeName}!</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border bg-card">
                <div className="flex items-end gap-2 bg-background border border-border rounded-2xl px-3 py-2 focus-within:ring-1 focus-within:ring-primary transition-all">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => {
                      setInputText(e.target.value);
                      // Auto-grow up to 5 rows
                      e.target.style.height = "auto";
                      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Write a message…"
                    className="flex-1 bg-transparent text-foreground border-0 outline-none resize-none text-sm py-1 no-scrollbar"
                    style={{ minHeight: "28px" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputText.trim() || sending}
                    className={`p-2 rounded-xl transition-all ${
                      inputText.trim()
                        ? "bg-primary text-white hover:brightness-110 shadow-md"
                        : "bg-muted text-muted-foreground"
                    } disabled:opacity-60`}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-[10px] text-muted-foreground text-center mt-1">Enter to send · Shift+Enter for new line</div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="h-20 w-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-primary/60" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Your messages</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                  Select a conversation or head to the Members page to start messaging someone.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
