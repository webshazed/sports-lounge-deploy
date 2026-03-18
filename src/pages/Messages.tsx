import { useState, useEffect, useRef } from "react";
import Header from "@/components/Header";
import Avatar from "@/components/Avatar";
import { apiFetch } from "@/lib/api";
import { getAuthUser } from "@/lib/auth";
import { Send, Search, MoreHorizontal, Info, Image as ImageIcon, Smile, MessageSquare } from "lucide-react";
import { useSearchParams } from "react-router-dom";
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

export default function Messages() {
  const [searchParams] = useSearchParams();
  const initialUser = searchParams.get("user");
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedCol, setSelectedCol] = useState<number | null>(initialUser ? Number(initialUser) : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const user = getAuthUser();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedCol) {
      fetchMessages(selectedCol);
      const interval = setInterval(() => fetchMessages(selectedCol), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedCol]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>("/api/messages");
      setConversations(data.conversations);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (userId: number) => {
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/api/messages/${userId}`);
      setMessages(data.messages);
    } catch (e) {
      // silent
    }
  };

  const sendMessage = async () => {
    if (!selectedCol || !inputText.trim()) return;
    try {
      const res = await apiFetch<{ message: Message }>("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: selectedCol, content: inputText.trim() }),
      });
      setMessages((prev) => [...prev, res.message]);
      setInputText("");
      fetchConversations();
    } catch (e) {
      toast.error("Failed to send message");
    }
  };

  const activeChat = conversations.find((c) => c.other_id === selectedCol);

  return (
    <div className="theme-light min-h-screen bg-background flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden border-t border-border">
        {/* Sidebar */}
        <div className="w-full md:w-80 lg:w-96 border-r border-border bg-card flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search messages"
                className="w-full bg-background text-foreground border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Loading conversations...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground italic">No messages yet.</div>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedCol(c.other_id)}
                  className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 ${
                    selectedCol === c.other_id ? "bg-muted/80 border-l-4 border-l-primary" : ""
                  }`}
                >
                  <Avatar
                    seed={c.full_name || c.username}
                    name={c.full_name || c.username}
                    src={c.avatar_url}
                    className="h-12 w-12"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="font-semibold text-sm text-foreground truncate">{c.full_name || c.username}</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                    <div className={`text-xs truncate ${!c.read_at && c.other_id === selectedCol ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat window */}
        <div className={`flex-1 flex flex-col bg-background ${!selectedCol ? "hidden md:flex" : "flex"}`}>
          {selectedCol ? (
            <>
              <div className="p-4 border-b border-border bg-card flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar
                    seed={activeChat?.full_name || activeChat?.username || "Chat"}
                    name={activeChat?.full_name || activeChat?.username || "Chat"}
                    src={activeChat?.avatar_url}
                    className="h-10 w-10"
                  />
                  <div>
                    <div className="font-semibold text-sm text-foreground">{activeChat?.full_name || activeChat?.username}</div>
                    <div className="text-[10px] text-emerald-500 font-medium">Online</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <button className="p-2 hover:bg-muted rounded-full transition-colors"><MoreHorizontal className="h-5 w-5" /></button>
                  <button className="p-2 hover:bg-muted rounded-full transition-colors"><Info className="h-5 w-5" /></button>
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-slate-50/50">
                {messages.map((m, idx) => {
                  const isMe = m.sender_id === user?.id;
                  const showDate = idx === 0 || new Date(m.created_at).toDateString() !== new Date(messages[idx-1].created_at).toDateString();
                  
                  return (
                    <div key={m.id} className="space-y-2">
                       {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="bg-white px-3 py-1 rounded-full border border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {new Date(m.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                       )}
                       <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                            isMe 
                              ? "bg-primary text-white rounded-tr-none" 
                              : "bg-white border border-border text-foreground rounded-tl-none"
                          }`}>
                            {m.content}
                            <div className={`text-[9px] mt-1 text-right ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                       </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-border bg-card">
                <div className="flex items-end gap-2 bg-background border border-border rounded-xl p-2 focus-within:ring-1 focus-within:ring-primary transition-all">
                  <textarea
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Write a message..."
                    className="flex-1 bg-transparent text-foreground border-0 outline-none resize-none text-sm p-2 no-scrollbar"
                  />
                  <div className="flex items-center gap-1">
                    <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"><Smile className="h-5 w-5" /></button>
                    <button className="p-2 hover:bg-muted rounded-full text-muted-foreground transition-colors"><ImageIcon className="h-5 w-5" /></button>
                    <button 
                      onClick={sendMessage}
                      disabled={!inputText.trim()}
                      className="p-2 bg-primary text-white rounded-lg hover:brightness-110 disabled:opacity-50 transition-all shadow-md"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="h-20 w-20 bg-muted rounded-full flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Select a conversation</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                   Pick a member from your existing chats or head to the Members tab to start a new connection.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
