import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import ConnectionBanner from "../ConnectionBanner";
import { api } from "../../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Clock,
  Bell,
  Search,
  LogOut,
  LayoutDashboard,
  Globe,
  Settings,
  Send,
  Power,
  History,
  TrendingUp,
  MessageCircle,
  Menu,
  CheckCircle,
  XCircle,
  Zap,
  RefreshCw,
} from "lucide-react";

const ALERT_SOUND = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

/* ─── Stat Card ──────────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, gradient }) => (
  <motion.div whileHover={{ y: -3 }} className="stat-card">
    <div style={{
      width: 46, height: 46, borderRadius: 12, flexShrink: 0,
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 14px rgba(37,99,235,0.18)",
    }}>
      <Icon size={20} color="#fff" />
    </div>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
        {title}
      </div>
      <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  </motion.div>
);

/* ─── Typing Indicator ───────────────────────────────────── */
const TypingIndicator = () => (
  <div style={{ display: "flex", alignItems: "flex-start" }}>
    <div style={{
      background: "#E2E8F0", borderRadius: "16px 16px 16px 4px",
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 5,
    }}>
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  </div>
);

/* ─── Main ───────────────────────────────────────────────── */
export default function AgentDashboard({ user, socket, onLogout, down }) {
  const [assignments, setAssignments] = useState([]);
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeChatInfo, setActiveChatInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [agentStatus, setAgentStatus] = useState("online");
  const [notif, setNotif] = useState([]);
  const [typing, setTyping] = useState(false);
  const [greeting, setGreeting] = useState({ propertyDbId: "", greeting: "" });
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formMsg, setFormMsg] = useState({ text: "", ok: true });

  const messagesEndRef = useRef(null);
  const activeChatRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimer = useRef(null);

  // Keep ref in sync
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const activeChats = Array.isArray(chats) ? chats.filter((c) => c?.status !== "closed").length : 0;
  const unreadCount = useMemo(() =>
    Array.isArray(chats) ? chats.reduce((acc, c) => acc + Number(c?.unread_count || 0), 0) : 0,
    [chats]
  );
  const unreadNotif = notif.filter((n) => !n.is_read).length;

  /* ── Load ── */
  const load = useCallback(async () => {
    try {
      const [a, c, n] = await Promise.all([
        api("/api/agent/assignments").catch((e) => { console.error("[Agent] assignments:", e.message); return []; }),
        api("/api/agent/chats").catch((e) => { console.error("[Agent] chats:", e.message); return []; }),
        api("/api/agent/notifications").catch((e) => { console.error("[Agent] notifications:", e.message); return []; }),
      ]);
      console.log("[Agent] Loaded → assignments:", a.length, "chats:", c.length, "notifs:", n.length);
      setAssignments(Array.isArray(a) ? a : []);
      setChats(Array.isArray(c) ? c : []);
      setNotif(Array.isArray(n) ? n : []);
    } catch (e) {
      console.error("[Agent] load failed:", e);
    }
  }, []);

  useEffect(() => {
    load();
    if ("Notification" in window) {
      Notification.requestPermission().then((p) => console.log("[Agent] Browser notif permission:", p));
    }
  }, [load]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  /* ── Socket ── */
  useEffect(() => {
    if (!socket) return;
    console.log("[Agent] Attaching socket listeners, id:", socket.id);

    const onAssign = (data) => {
      console.log("[Agent] agent_assigned →", data);
      load();
    };

    const onMsg = (m) => {
      console.log("[Agent] new_message →", m);
      if (m.sender === "visitor") {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Chattrix — New Message", {
            body: m.message,
            icon: "/favicon.ico",
          });
        }
        new Audio(ALERT_SOUND).play().catch(() => {});
      }
      // If message belongs to current open chat, append immediately
      if (activeChatRef.current === m.chatId || activeChatRef.current === Number(m.chatId)) {
        setMessages((prev) => {
          // avoid duplicates (socket may echo back our own send)
          if (prev.some((pm) => pm.id && pm.id === m.id)) return prev;
          return [...prev, { ...m, created_at: m.created_at || new Date().toISOString() }];
        });
      }
      load();
    };

    const onTyping = (d) => {
      console.log("[Agent] typing →", d);
      if (d.sender === "visitor") {
        setTyping(true);
        clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setTyping(false), 3000);
      }
    };
    const onStopTyping = (d) => {
      if (d?.sender === "visitor") setTyping(false);
    };

    const onAgentStatusChange = (d) => {
      console.log("[Agent] agent_status_change →", d);
    };

    socket.on("agent_assigned", onAssign);
    socket.on("new_message", onMsg);
    socket.on("typing", onTyping);
    socket.on("stop_typing", onStopTyping);
    socket.on("agent_status_change", onAgentStatusChange);

    return () => {
      socket.off("agent_assigned", onAssign);
      socket.off("new_message", onMsg);
      socket.off("typing", onTyping);
      socket.off("stop_typing", onStopTyping);
      socket.off("agent_status_change", onAgentStatusChange);
    };
  }, [socket, load]);

  /* ── Open chat ── */
  const openChat = async (chat) => {
    const chatId = typeof chat === "object" ? chat.id : chat;
    console.log("[Agent] Opening chat ID:", chatId, "Object:", JSON.stringify(chat, null, 2));
    setActiveChat(chatId);
    setActiveChatInfo(typeof chat === "object" ? chat : null);
    setMessages([]);
    setTyping(false);

    try {
      await api(`/api/agent/chats/${chatId}/join`, { method: "POST" });
      const msgs = await api(`/api/chat/${chatId}/messages`);
      console.log("[Agent] Loaded", msgs.length, "messages for chat", chatId);
      setMessages(Array.isArray(msgs) ? msgs : []);
      socket?.emit("agent_join", { chatId });
      socket?.emit("message_read", { chatId, reader: "agent" });
      inputRef.current?.focus();
    } catch (err) {
      console.error("[Agent] openChat error:", err.message);
    }
    load();
  };

  /* ── Send message ── */
  const send = async (e) => {
    e.preventDefault();
    if (!msg.trim() || !activeChat) return;
    const message = msg.trim();
    console.log("[Agent] Sending:", message, "to chat:", activeChat);
    socket.emit("new_message", {
      chatId: activeChat,
      sender: "agent",
      senderId: user.id,
      message,
    });
    setMsg("");
    socket.emit("stop_typing", { chatId: activeChat, sender: "agent" });
  };

  /* ── Respond to assignment ── */
  const respond = async (id, accept) => {
    console.log("[Agent] Responding to assignment", id, accept ? "ACCEPT" : "DECLINE");
    try {
      await api(`/api/agent/assignments/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      });
      load();
    } catch (err) {
      console.error("[Agent] respond error:", err.message);
    }
  };

  /* ── Status toggle ── */
  const changeStatus = async (s) => {
    console.log("[Agent] Changing status to:", s);
    setAgentStatus(s);
    try {
      await api("/api/agent/status", { method: "POST", body: JSON.stringify({ status: s }) });
    } catch (err) {
      console.error("[Agent] changeStatus error:", err.message);
    }
  };

  /* ── Save greeting ── */
  const saveGreeting = async (e) => {
    e.preventDefault();
    if (!greeting.propertyDbId) { setFormMsg({ text: "Select a property.", ok: false }); return; }
    try {
      await api("/api/agent/greeting", {
        method: "POST",
        body: JSON.stringify({ propertyDbId: Number(greeting.propertyDbId), greeting: greeting.greeting }),
      });
      console.log("[Agent] Greeting saved");
      setGreeting({ propertyDbId: "", greeting: "" });
      setFormMsg({ text: "Greeting saved!", ok: true });
      load();
    } catch (err) {
      console.error("[Agent] saveGreeting:", err.message);
      setFormMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setFormMsg({ text: "", ok: true }), 3000);
  };

  /* ── End chat ── */
  const endChat = async () => {
    if (!activeChat) return;
    try {
      await api(`/api/agent/chats/${activeChat}/end`, { method: "POST" });
      console.log("[Agent] Ended chat:", activeChat);
      setActiveChat(null);
      setActiveChatInfo(null);
      setMessages([]);
      load();
    } catch (err) {
      console.error("[Agent] endChat:", err.message);
    }
  };

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Live Chats", icon: MessageSquare },
    { name: "Properties", icon: Globe },
    { name: "Settings", icon: Settings },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Inter',sans-serif", background: "#F8FAFC" }}>
      <ConnectionBanner down={down} />

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 49, backdropFilter: "blur(2px)" }}
        />
      )}

      {/* ── Sidebar ── */}
      <aside style={{
        width: 258, flexShrink: 0, background: "#0F172A",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh", zIndex: 50,
      }}
        data-open={sidebarOpen}
      >
        {/* Logo */}
        <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: "linear-gradient(135deg,#2563EB,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(37,99,235,0.30)", flexShrink: 0,
            }}>
              <MessageCircle size={18} color="#fff" />
            </div>
            <div>
              <div className="sidebar-logo-text">Chattrix</div>
              <div className="sidebar-tagline">Smarter Live Chat for<br />Modern Businesses.</div>
            </div>
          </div>
        </div>

        {/* Status toggle */}
        <div style={{ padding: "0.625rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <button
            onClick={() => changeStatus(agentStatus === "online" ? "offline" : "online")}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
              background: agentStatus === "online" ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
              color: agentStatus === "online" ? "#22C55E" : "#64748B",
              fontWeight: 700, fontSize: 13, fontFamily: "inherit", transition: "all 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Power size={14} />
              <span>{agentStatus === "online" ? "Online" : "Offline"}</span>
            </div>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: agentStatus === "online" ? "#22C55E" : "#64748B",
              animation: agentStatus === "online" ? "pulse-dot 1.5s infinite" : "none",
            }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "0.75rem", overflowY: "auto" }}>
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => { setActiveTab(item.name); setSidebarOpen(false); }}
              className={`nav-item${activeTab === item.name ? " active" : ""}`}
              style={{ marginBottom: 3 }}
            >
              <item.icon size={17} />
              <span style={{ flex: 1 }}>{item.name}</span>
              {item.name === "Live Chats" && unreadCount > 0 && (
                <span style={{
                  background: "#2563EB", color: "#fff", fontSize: 10, fontWeight: 800,
                  minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "0.875rem", borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 4px 10px" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: "linear-gradient(135deg,#2563EB,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 800, color: "#fff", fontSize: 13, flexShrink: 0,
            }}>
              {user?.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.name || "Agent"}
              </div>
              <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600 }}>Support Agent</div>
            </div>
          </div>
          <button onClick={onLogout} className="btn-danger" style={{ width: "100%", justifyContent: "center", padding: "9px" }}>
            <LogOut size={14} /> Sign Out
          </button>
          <p className="footer-credit" style={{ color: "#334155", marginTop: 6 }}>Design by Kapil Chopra</p>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {/* Topbar */}
        <header className="topbar" style={{
          height: 60, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 1.25rem",
          position: "sticky", top: 0, zIndex: 40, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              style={{
                width: 36, height: 36, border: "1px solid #E5E7EB", borderRadius: 9,
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B",
              }}
            >
              <Menu size={17} />
            </button>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{activeTab}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: down ? "#EF4444" : "#22C55E",
                  animation: !down ? "pulse-dot 1.5s infinite" : "none",
                }} />
                <span style={{ fontSize: 11, color: "#64748B", fontWeight: 500 }}>
                  {down ? "Reconnecting…" : "Connected"}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={load}
              style={{
                width: 34, height: 34, border: "1px solid #E5E7EB", borderRadius: 9,
                background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Refresh"
            >
              <RefreshCw size={14} color="#64748B" />
            </button>

            <button style={{
              position: "relative", width: 34, height: 34, border: "1px solid #E5E7EB",
              borderRadius: 9, background: "#fff", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onClick={() => api("/api/agent/notifications/read", { method: "POST" }).then(load)}
              title="Mark all notifications read"
            >
              <Bell size={15} color="#64748B" />
              {unreadNotif > 0 && (
                <span style={{
                  position: "absolute", top: 6, right: 6, width: 8, height: 8,
                  background: "#2563EB", borderRadius: "50%", border: "2px solid #fff",
                }} />
              )}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: "1px solid #E5E7EB" }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: "linear-gradient(135deg,#2563EB,#7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, color: "#fff", fontSize: 12,
              }}
                title={user?.name}
              >
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
            </div>
          </div>
        </header>

        {/* Form feedback */}
        <AnimatePresence>
          {formMsg.text && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{
                margin: "0.75rem 1.25rem 0",
                padding: "9px 14px", borderRadius: 10,
                background: formMsg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${formMsg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: formMsg.ok ? "#16A34A" : "#DC2626",
                fontSize: 13, fontWeight: 600, flexShrink: 0,
              }}
            >
              {formMsg.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          <div style={{ maxWidth: 1440, margin: "0 auto" }}>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "1rem", marginBottom: "1.25rem" }}>
              <StatCard title="Active Chats"   value={activeChats}    icon={MessageSquare} gradient="linear-gradient(135deg,#2563EB,#3B82F6)" />
              <StatCard title="Total Contacts" value={chats.length}   icon={TrendingUp}    gradient="linear-gradient(135deg,#7C3AED,#9333EA)" />
              <StatCard title="Unread"         value={unreadCount}    icon={Bell}          gradient="linear-gradient(135deg,#059669,#22C55E)" />
              <StatCard title="Assignments"    value={assignments.length} icon={Clock}    gradient="linear-gradient(135deg,#D97706,#F59E0B)" />
            </div>

            {/* Main grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)", gap: "1.25rem", alignItems: "start" }}>

              {/* ── Chat Window ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div className="section-card" style={{ display: "flex", flexDirection: "column", height: 580 }}>
                  {/* Chat header */}
                  <div style={{
                    background: "linear-gradient(135deg,#2563EB,#7C3AED)",
                    padding: "0.875rem 1.25rem", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: "rgba(255,255,255,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <MessageSquare size={20} color="#fff" />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                              {activeChatInfo ? activeChatInfo.visitor_name : activeChat ? `Chat #${activeChat}` : "Select a chat"}
                            </div>
                            {activeChatInfo && (
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: "1px 6px",
                                borderRadius: 5, background: "rgba(255,255,255,0.2)", color: "#fff",
                                textTransform: "uppercase"
                              }}>
                                {activeChatInfo.property_name}
                              </span>
                            )}
                          </div>
                          {activeChatInfo && (
                            <div style={{ display: "flex", gap: 10, fontSize: 11, color: "rgba(255,255,255,0.8)" }}>
                              <span>{activeChatInfo.visitor_email}</span>
                              <span style={{ opacity: 0.5 }}>|</span>
                              <span>{activeChatInfo.visitor_phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    {activeChat && (
                      <button
                        onClick={endChat}
                        style={{
                          padding: "6px 12px", borderRadius: 7,
                          background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)",
                          color: "#FCA5A5", fontWeight: 700, fontSize: 11, cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        End Chat
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
                    {messages.length === 0 && !typing ? (
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <MessageSquare size={44} color="#E2E8F0" />
                        <p style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>
                          {activeChat ? "No messages yet. Start the conversation!" : "Select a chat from the right panel."}
                        </p>
                      </div>
                    ) : (
                      messages.map((m, idx) => (
                        <motion.div
                          key={m?.id || idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          style={{
                            display: "flex", flexDirection: "column",
                            alignItems: m?.sender === "visitor" ? "flex-start" : "flex-end",
                          }}
                        >
                          <div style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600, marginBottom: 3 }}>
                            {m?.sender === "visitor" ? (activeChatInfo?.visitor_name || "Visitor") : "You"}
                          </div>
                          {/* visitor = gray, agent = blue */}
                          <div className={m?.sender === "visitor" ? "msg-agent" : "msg-visitor"} style={{ maxWidth: "78%" }}>
                            {m?.message}
                            <div className={m?.sender === "visitor" ? "msg-time-agent" : "msg-time"}>
                              {m?.created_at
                                ? new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : ""}
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                    {typing && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div style={{ padding: "0.75rem", borderTop: "1px solid #E5E7EB", background: "#FFFFFF", flexShrink: 0 }}>
                    <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
                      <input
                        ref={inputRef}
                        className="form-input"
                        style={{ flex: 1, borderRadius: 999 }}
                        placeholder={activeChat ? "Type your reply…" : "Select a chat first"}
                        value={msg}
                        disabled={!activeChat}
                        onChange={(e) => {
                          setMsg(e.target.value);
                          if (activeChat && socket) {
                            socket.emit("typing", { chatId: activeChat, sender: "agent" });
                          }
                        }}
                      />
                      <button
                        type="submit"
                        className="btn-primary"
                        style={{ borderRadius: 999, padding: "0 18px", flexShrink: 0 }}
                        disabled={!activeChat || !msg.trim()}
                      >
                        <Send size={15} />
                        Send
                      </button>
                    </form>
                  </div>
                </div>

                {/* Auto Greeting */}
                <div className="section-card">
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "0.875rem 1.25rem", borderBottom: "1px solid #E5E7EB", background: "#FAFAFA",
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: "linear-gradient(135deg,#2563EB,#7C3AED)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Zap size={15} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>Auto Greeting</span>
                  </div>
                  <form onSubmit={saveGreeting} style={{ padding: "1rem", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ minWidth: 160 }}>
                      <label className="form-label">Property</label>
                      <select
                        className="form-select"
                        value={greeting.propertyDbId}
                        onChange={(e) => setGreeting({ ...greeting, propertyDbId: e.target.value })}
                      >
                        <option value="">Select property…</option>
                        {assignments.filter((a) => a.status === "accepted").map((a) => (
                          <option key={a.id} value={a.property_db_id}>{a.property_name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <label className="form-label">Greeting Message</label>
                      <input
                        className="form-input"
                        placeholder="Hi! How can I help you today?"
                        value={greeting.greeting}
                        onChange={(e) => setGreeting({ ...greeting, greeting: e.target.value })}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ flexShrink: 0, alignSelf: "flex-end", marginBottom: 1 }}>
                      Save
                    </button>
                  </form>
                </div>
              </div>

              {/* ── Right Panel ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

                {/* Assignments */}
                <div className="section-card" style={{ maxHeight: 340, display: "flex", flexDirection: "column" }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.75rem 1.25rem", borderBottom: "1px solid #E5E7EB", background: "#FAFAFA",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <History size={15} color="#2563EB" />
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>Assignments</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
                      borderRadius: "50%", background: "#EFF6FF", color: "#2563EB",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      border: "1px solid #BFDBFE",
                    }}>
                      {assignments.length}
                    </span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {assignments.length === 0 && (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                        No assignments yet. Admin will assign you to a property.
                      </div>
                    )}
                    {assignments.map((a) => (
                      <div key={a.id} style={{
                        padding: "0.75rem 1.25rem",
                        borderBottom: "1px solid #F8FAFC",
                        borderLeft: "3px solid #2563EB",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: a.status === "pending" ? 6 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{a.property_name}</span>
                          <span className={a.status === "accepted" ? "badge-success" : a.status === "declined" ? "badge-neutral" : "badge-warning"}>
                            {a.status}
                          </span>
                        </div>
                        {a.status === "pending" && (
                          <div style={{ display: "flex", gap: 7, marginTop: 8 }}>
                            <button
                              onClick={() => respond(a.id, true)}
                              style={{
                                flex: 1, padding: "7px", borderRadius: 8,
                                background: "#22C55E", color: "#fff", border: "none",
                                cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              }}
                            >
                              <CheckCircle size={13} /> Accept
                            </button>
                            <button
                              onClick={() => respond(a.id, false)}
                              style={{
                                flex: 1, padding: "7px", borderRadius: 8,
                                background: "#F1F5F9", color: "#64748B",
                                border: "1px solid #E5E7EB", cursor: "pointer", fontWeight: 700, fontSize: 12, fontFamily: "inherit",
                                display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                              }}
                            >
                              <XCircle size={13} /> Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inbound Chats */}
                <div className="section-card" style={{ maxHeight: 420, display: "flex", flexDirection: "column" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "0.75rem 1.25rem", borderBottom: "1px solid #E5E7EB", background: "#FAFAFA",
                  }}>
                    <MessageSquare size={15} color="#2563EB" />
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>Inbound Chats</span>
                    {unreadCount > 0 && (
                      <span style={{
                        marginLeft: "auto", background: "#2563EB", color: "#fff",
                        fontSize: 10, fontWeight: 800, minWidth: 18, height: 18,
                        borderRadius: 9, padding: "0 4px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {chats.length === 0 && (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                        No chats assigned to you yet.
                      </div>
                    )}
                    {chats.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => { openChat(c); setActiveTab("Live Chats"); }}
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "0.875rem 1.25rem",
                          borderBottom: "1px solid #F8FAFC",
                          borderLeft: `3px solid ${activeChat === c.id ? "#2563EB" : "transparent"}`,
                          background: activeChat === c.id ? "#EFF6FF" : "#fff",
                          cursor: "pointer", border: "none", fontFamily: "inherit",
                          transition: "background 0.12s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                              background: c.status === "active" ? "#22C55E" : c.status === "waiting" ? "#F59E0B" : "#CBD5E1",
                            }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{c.visitor_name}</span>
                          </div>
                          {Number(c.unread_count) > 0 && (
                            <span style={{
                              background: "#2563EB", color: "#fff", fontSize: 10, fontWeight: 800,
                              minWidth: 18, height: 18, borderRadius: 9, padding: "0 4px",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {c.unread_count}
                            </span>
                          )}
                        </div>

                        {/* Property Badge */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingLeft: 12, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, background: "#F3E8FF", color: "#7C3AED",
                            padding: "1px 6px", borderRadius: 4, textTransform: "uppercase"
                          }}>
                            {c?.property_name || "Unknown"}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: "#64748B", paddingLeft: 12, display: "flex", flexDirection: "column", gap: 1 }}>
                          <div style={{ wordBreak: "break-all" }}>{c?.visitor_email || "No email"}</div>
                          <div style={{ fontWeight: 600 }}>{c?.visitor_phone || "No phone"}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <div className="section-card">
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.75rem 1.25rem", borderBottom: "1px solid #E5E7EB", background: "#FAFAFA",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Bell size={15} color="#2563EB" />
                      <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>
                        Notifications {unreadNotif > 0 && <span style={{ color: "#2563EB" }}>({unreadNotif})</span>}
                      </span>
                    </div>
                    <button
                      onClick={() => api("/api/agent/notifications/read", { method: "POST" }).then(load)}
                      style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, border: "none", background: "none", cursor: "pointer", fontFamily: "inherit" }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    {notif.length === 0 && (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                        No notifications yet.
                      </div>
                    )}
                    {notif.map((n) => (
                      <div key={n.id} style={{
                        display: "flex", alignItems: "flex-start", gap: 9,
                        padding: "0.625rem 1.25rem",
                        borderBottom: "1px solid #F8FAFC",
                        opacity: n.is_read ? 0.55 : 1,
                        background: n.is_read ? "#fff" : "#FAFEFF",
                      }}>
                        <div style={{
                          width: 7, height: 7, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                          background: n.is_read ? "#CBD5E1" : "#2563EB",
                        }} />
                        <div>
                          <p style={{ fontSize: 12, color: "#475569", fontWeight: 500, lineHeight: 1.4, margin: 0 }}>{n.message}</p>
                          <p style={{ fontSize: 10, color: "#94A3B8", marginTop: 2, margin: 0 }}>
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="footer-credit" style={{ marginTop: "1.5rem" }}>Design by Kapil Chopra</p>
          </div>
        </div>
      </main>

      {/* Mobile sidebar */}
      <style>{`
        @media (max-width: 1023px) {
          aside[data-open="false"] {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          }
          aside[data-open="true"] {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            transform: translateX(0);
            transition: transform 0.28s cubic-bezier(0.4,0,0.2,1);
          }
        }
        @media (min-width: 1024px) {
          aside { position: sticky !important; transform: none !important; }
        }
      `}</style>
    </div>
  );
}
