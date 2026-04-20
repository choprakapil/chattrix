import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../lib/api";
import ConnectionBanner from "../ConnectionBanner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Globe, MessageSquare, Settings, LayoutDashboard, LogOut,
  Plus, Bell, Menu, CheckCircle2, Clock, UserPlus, TrendingUp,
  RefreshCw, User, Volume2, Calendar, Link2, Copy, Check,
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from "recharts";

/* ─── Stat Card ─────────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, gradient }) => (
  <motion.div whileHover={{ y: -3 }} className="stat-card">
    <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: gradient, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 18px rgba(37,99,235,0.18)" }}>
      <Icon size={24} color="#fff" />
    </div>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>{value ?? "—"}</div>
    </div>
  </motion.div>
);

/* ─── Section Header ─────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, title, badge }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", borderBottom: "1px solid #E5E7EB", background: "#FAFAFA" }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} color="#fff" />
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{title}</span>
    </div>
    {badge && <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE" }}>{badge}</span>}
  </div>
);

/* ─── Main ───────────────────────────────────────────────── */
export default function AdminDashboard({ user, socket, onLogout, down }) {
  const [agents, setAgents] = useState([]);
  const [properties, setProperties] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [chats, setChats] = useState([]);
  const [allChats, setAllChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [agentForm, setAgentForm] = useState({ name: "", username: "", password: "" });
  const [propForm, setPropForm] = useState({ name: "", url: "" });
  const [assign, setAssign] = useState({ propertyDbId: "", agentIds: [] });
  const [searchQ, setSearchQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [copied, setCopied] = useState(null);
  const [formMsg, setFormMsg] = useState({ text: "", ok: true });
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [stats, setStats] = useState({ totalVisitors: 0, activeChats: 0, agentsOnline: 0, avgResponse: "0s", trend: [] });
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifBanners, setNotifBanners] = useState(true);
  const messagesEndRef = useRef(null);
  const selectedChatRef = useRef(null);

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  /* ── Load all data ── */
  const load = useCallback(async () => {
    try {
      const qParams = new URLSearchParams();
      if (dateRange.from) qParams.append("from", dateRange.from);
      if (dateRange.to) qParams.append("to", dateRange.to);
      const [a, p, ass, c, s] = await Promise.all([
        api("/api/admin/agents").catch(() => []),
        api("/api/admin/properties").catch(() => []),
        api("/api/admin/assignments").catch(() => []),
        api(`/api/admin/chats?${qParams.toString()}`).catch(() => []),
        api(`/api/admin/stats?${qParams.toString()}`).catch(() => ({})),
      ]);
      setAgents(Array.isArray(a) ? a : []);
      setProperties(Array.isArray(p) ? p : []);
      setAssignments(Array.isArray(ass) ? ass : []);
      if (s && !s.trend) s.trend = [];
      setStats(s || { totalVisitors: 0, activeChats: 0, agentsOnline: 0, avgResponse: "0s", trend: [] });
      const chatList = Array.isArray(c) ? c : [];
      setAllChats(chatList);
      setChats(chatList);
    } catch (e) { console.error("[Admin] load failed:", e); }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  /* ── Socket events ── */
  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => load();
    const onNewMsg = (m) => {
      if (selectedChatRef.current === m.chatId) setMessages(prev => [...prev, m]);
      load();
    };
    socket.on("assignment_accepted", onUpdate);
    socket.on("assignment_declined", onUpdate);
    socket.on("agent_status_change", onUpdate);
    socket.on("new_message", onNewMsg);
    socket.on("visitor_opened_chat", onUpdate);
    return () => {
      socket.off("assignment_accepted", onUpdate);
      socket.off("assignment_declined", onUpdate);
      socket.off("agent_status_change", onUpdate);
      socket.off("new_message", onNewMsg);
      socket.off("visitor_opened_chat", onUpdate);
    };
  }, [socket, load]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  /* ── Local chat search ── */
  useEffect(() => {
    let filtered = allChats;
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter(c =>
        (c.visitor_name || "").toLowerCase().includes(q) ||
        (c.visitor_email || "").toLowerCase().includes(q) ||
        (c.property_name || "").toLowerCase().includes(q)
      );
    }
    setChats(filtered);
  }, [searchQ, allChats]);

  /* ── Actions ── */
  const showMsg = (text, ok = true) => {
    setFormMsg({ text, ok });
    setTimeout(() => setFormMsg({ text: "", ok: true }), 3000);
  };

  const createAgent = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/agents", { method: "POST", body: JSON.stringify(agentForm) });
      setAgentForm({ name: "", username: "", password: "" });
      showMsg("Agent created successfully!");
      load();
    } catch (err) { showMsg(err.message, false); }
  };

  const createProperty = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/properties", { method: "POST", body: JSON.stringify(propForm) });
      setPropForm({ name: "", url: "" });
      showMsg("Property added!");
      load();
    } catch (err) { showMsg(err.message, false); }
  };

  const assignAgents = async (e) => {
    e.preventDefault();
    if (!assign.propertyDbId) { showMsg("Select a property first.", false); return; }
    if (!assign.agentIds.length) { showMsg("Select at least one agent.", false); return; }
    try {
      await api("/api/admin/assign", {
        method: "POST",
        body: JSON.stringify({ propertyDbId: Number(assign.propertyDbId), agentIds: assign.agentIds.map(Number) }),
      });
      setAssign({ propertyDbId: "", agentIds: [] });
      showMsg("Agents assigned successfully!");
      load();
    } catch (err) { showMsg(err.message, false); }
  };

  const openChat = async (chatId) => {
    setSelectedChat(chatId);
    try {
      const msgs = await api(`/api/admin/chats/${chatId}/messages`);
      setMessages(Array.isArray(msgs) ? msgs : []);
      socket?.emit("agent_join", { chatId });
    } catch { setMessages([]); }
  };

  const copyEmbed = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const activeChats = allChats.filter(c => c?.status !== "closed").length;

  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Live Chats", icon: MessageSquare },
    { name: "Agents", icon: Users },
    { name: "Properties", icon: Globe },
    { name: "Settings", icon: Settings },
  ];

  /* ── Renderers ── */
  const renderDashboard = () => {
    const trendData = stats.trend?.length > 0 ? stats.trend : [{ name: "No Data", chats: 0 }];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
          <StatCard title="Active Chats"   value={stats.activeChats}   icon={MessageSquare} gradient="linear-gradient(135deg,#2563EB,#3B82F6)" />
          <StatCard title="Total Visitors" value={stats.totalVisitors} icon={TrendingUp}    gradient="linear-gradient(135deg,#7C3AED,#9333EA)" />
          <StatCard title="Agents Online"  value={stats.agentsOnline}  icon={Users}         gradient="linear-gradient(135deg,#059669,#22C55E)" />
          <StatCard title="Avg Response"   value={stats.avgResponse}   icon={Clock}         gradient="linear-gradient(135deg,#D97706,#F59E0B)" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem" }}>
          <div className="section-card" style={{ padding: "1.5rem" }}>
            <SectionHeader icon={TrendingUp} title="Message Volume Trend" />
            <div style={{ height: 300, marginTop: "1rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", fontSize: 12 }} />
                  <Area type="monotone" dataKey="chats" stroke="#2563EB" strokeWidth={3} fill="url(#colorChats)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="section-card">
            <SectionHeader icon={Calendar} title="Filter Period" />
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div><label className="form-label">From Date</label><input type="date" className="form-input" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} /></div>
              <div><label className="form-label">To Date</label><input type="date" className="form-input" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} /></div>
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={load}>Update Analytics</button>
              <button className="btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => { setDateRange({ from: "", to: "" }); setTimeout(load, 50); }}>Clear Filter</button>
            </div>
          </div>
        </div>
        {/* Recent Assignments Summary */}
        <div className="section-card">
          <SectionHeader icon={Users} title="Recent Agent Assignments" badge={`${assignments.length} Total`} />
          {assignments.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No assignments yet. Assign agents to properties in the Properties tab.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["Property", "Agent", "Status", "Assigned"].map(h => (
                      <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.slice(0, 8).map(a => (
                    <tr key={a.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{a.property_name}</td>
                      <td style={{ padding: "10px 16px" }}>{a.agent_name}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span className={a.status === "accepted" ? "badge-success" : a.status === "declined" ? "badge-neutral" : "badge-warning"}>{a.status}</span>
                      </td>
                      <td style={{ padding: "10px 16px", color: "#94A3B8" }}>{new Date(a.assigned_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLiveChats = () => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", gap: "1.25rem" }}>
      <div className="section-card" style={{ display: "flex", flexDirection: "column", height: 680 }}>
        <div style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)", padding: "1rem 1.25rem", flexShrink: 0 }}>
          {selectedChat ? (() => {
            const c = allChats.find(x => x.id === selectedChat);
            return (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{c?.visitor_name || `Chat #${selectedChat}`}</div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.2)", color: "#fff", textTransform: "uppercase" }}>{c?.property_name}</span>
                </div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>{c?.visitor_email} {c?.visitor_phone && `· ${c.visitor_phone}`}</div>
              </div>
            );
          })() : <div style={{ color: "#fff", fontWeight: 700 }}>Select a conversation to view</div>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
          {messages.length === 0
            ? <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#CBD5E1" }}><MessageSquare size={48} /><p style={{ marginTop: 10, fontWeight: 600, fontSize: 13 }}>No messages yet</p></div>
            : messages.map((m, idx) => (
              <div key={m.id || idx} style={{ display: "flex", flexDirection: "column", alignItems: m.sender === "visitor" ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 2, fontWeight: 600 }}>{m.sender === "visitor" ? "Visitor" : "Agent"}</div>
                <div className={m.sender === "visitor" ? "msg-visitor" : "msg-agent"} style={{ maxWidth: "80%" }}>
                  {m.message}
                  <div style={{ fontSize: 9, opacity: 0.7, textAlign: "right", marginTop: 3 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="section-card" style={{ display: "flex", flexDirection: "column", maxHeight: 680 }}>
        <SectionHeader icon={MessageSquare} title="Inquiries" badge={`${chats.length}`} />
        <div style={{ padding: "0.75rem", borderBottom: "1px solid #F1F5F9" }}>
          <input className="form-input" placeholder="Search visitors, email, property..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.length === 0 && <div style={{ padding: "2rem", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No conversations found.</div>}
          {chats.map(c => (
            <button key={c.id} onClick={() => openChat(c.id)} style={{ width: "100%", padding: "1rem", border: "none", background: selectedChat === c.id ? "#EFF6FF" : "transparent", borderBottom: "1px solid #F1F5F9", textAlign: "left", cursor: "pointer", borderLeft: `3px solid ${selectedChat === c.id ? "#2563EB" : "transparent"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: "#0F172A" }}>{c.visitor_name}</span>
                <span className={c.status === "active" ? "badge-success" : c.status === "waiting" ? "badge-warning" : "badge-neutral"} style={{ fontSize: 9 }}>{c.status}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED" }}>{c.property_name}</div>
              <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{c.last_message || "No messages yet"}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAgents = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.25rem" }}>
      <div className="section-card">
        <SectionHeader icon={Users} title="Your Team" badge={`${agents.length} Agents`} />
        {agents.length === 0
          ? <div style={{ padding: "3rem", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No agents added yet. Create one on the right.</div>
          : agents.map(a => (
            <div key={a.id} style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 17, flexShrink: 0 }}>{a.name[0]}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14 }}>{a.name}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>@{a.username}</div>
              </div>
              <span className={a.status === "online" ? "badge-success" : "badge-neutral"}>{a.status}</span>
            </div>
          ))
        }
      </div>
      <div className="section-card" style={{ height: "fit-content" }}>
        <SectionHeader icon={UserPlus} title="Add New Agent" />
        <form onSubmit={createAgent} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Full Name</label><input className="form-input" placeholder="Jane Smith" value={agentForm.name} onChange={e => setAgentForm({ ...agentForm, name: e.target.value })} required /></div>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Username</label><input className="form-input" placeholder="jane_smith" value={agentForm.username} onChange={e => setAgentForm({ ...agentForm, username: e.target.value })} required /></div>
          <div style={{ marginBottom: "1.25rem" }}><label className="form-label">Password</label><input className="form-input" type="password" placeholder="••••••••" value={agentForm.password} onChange={e => setAgentForm({ ...agentForm, password: e.target.value })} required /></div>
          <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>Create Agent Account</button>
        </form>
      </div>
    </div>
  );

  const renderProperties = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.25rem" }}>
        {/* Properties list */}
        <div className="section-card">
          <SectionHeader icon={Globe} title="Registered Websites" badge={`${properties.length}`} />
          {properties.length === 0
            ? <div style={{ padding: "3rem", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No properties added yet.</div>
            : properties.map(p => (
              <div key={p.id} style={{ padding: "1.25rem", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900, color: "#0F172A", fontSize: 15 }}>{p.name}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Link2 size={11} color="#94A3B8" />
                      <span style={{ fontSize: 12, color: "#64748B" }}>{p.url}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: 6 }}>Widget Embed Code</label>
                  <div style={{ display: "flex", gap: 8, background: "#F8FAFC", padding: "10px 12px", borderRadius: 10, border: "1px solid #E5E7EB" }}>
                    <code style={{ fontSize: 10, flex: 1, fontFamily: "monospace", color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.embedScript}</code>
                    <button className="btn-primary" style={{ padding: "4px 10px", fontSize: 11, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }} onClick={() => copyEmbed(p.embedScript, p.id)}>
                      {copied === p.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                    </button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
        {/* Add property */}
        <div className="section-card" style={{ height: "fit-content" }}>
          <SectionHeader icon={Plus} title="Add New Website" />
          <form onSubmit={createProperty} style={{ padding: "1.5rem" }}>
            <div style={{ marginBottom: "1rem" }}><label className="form-label">Website Name</label><input className="form-input" placeholder="My Store" value={propForm.name} onChange={e => setPropForm({ ...propForm, name: e.target.value })} required /></div>
            <div style={{ marginBottom: "1.25rem" }}><label className="form-label">Production URL</label><input className="form-input" placeholder="https://example.com" value={propForm.url} onChange={e => setPropForm({ ...propForm, url: e.target.value })} required /></div>
            <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>Register Property</button>
          </form>
        </div>
      </div>

      {/* ── Assign Agents to Property ── */}
      <div className="section-card">
        <SectionHeader icon={Users} title="Assign Agents to Property" />
        <form onSubmit={assignAgents} style={{ padding: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
            <div>
              <label className="form-label">Select Property</label>
              <select className="form-select" value={assign.propertyDbId} onChange={e => setAssign({ ...assign, propertyDbId: e.target.value })}>
                <option value="">Choose a property…</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label" style={{ marginBottom: 10 }}>Select Agents</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {agents.length === 0
                  ? <span style={{ fontSize: 13, color: "#94A3B8" }}>No agents yet. Add agents first.</span>
                  : agents.map(a => {
                    const checked = assign.agentIds.includes(String(a.id));
                    return (
                      <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: `1.5px solid ${checked ? "#2563EB" : "#E5E7EB"}`, background: checked ? "#EFF6FF" : "#F8FAFC", fontSize: 13, fontWeight: 600 }}>
                        <input type="checkbox" checked={checked} onChange={e => {
                          const ids = e.target.checked ? [...assign.agentIds, String(a.id)] : assign.agentIds.filter(x => x !== String(a.id));
                          setAssign({ ...assign, agentIds: ids });
                        }} style={{ accentColor: "#2563EB" }} />
                        <span style={{ color: checked ? "#1D4ED8" : "#374151" }}>{a.name}</span>
                        <span className={a.status === "online" ? "badge-success" : "badge-neutral"} style={{ fontSize: 9 }}>{a.status}</span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ justifyContent: "center", padding: "10px 28px" }}>Assign Selected Agents</button>
          <p style={{ marginTop: 10, fontSize: 11, color: "#94A3B8" }}>
            Agents will receive a notification to accept or decline the assignment.
          </p>
        </form>

        {/* Current assignment status */}
        {assignments.length > 0 && (
          <div style={{ borderTop: "1px solid #E5E7EB" }}>
            <div style={{ padding: "0.875rem 1.25rem", fontWeight: 700, fontSize: 13, color: "#374151", background: "#FAFAFA" }}>Current Assignments</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Property", "Agent", "Status", "Assigned On"].map(h => (
                      <th key={h} style={{ padding: "8px 16px", textAlign: "left", fontWeight: 700, color: "#64748B", fontSize: 11, textTransform: "uppercase", background: "#F8FAFC" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => (
                    <tr key={a.id} style={{ borderTop: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{a.property_name}</td>
                      <td style={{ padding: "10px 16px" }}>{a.agent_name}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span className={a.status === "accepted" ? "badge-success" : a.status === "declined" ? "badge-neutral" : "badge-warning"}>{a.status}</span>
                      </td>
                      <td style={{ padding: "10px 16px", color: "#94A3B8" }}>{new Date(a.assigned_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.25rem" }}>
      {/* Profile card */}
      <div className="section-card" style={{ height: "fit-content" }}>
        <div style={{ padding: "2rem 1.5rem", textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#2563EB,#7C3AED)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 32, fontWeight: 900, boxShadow: "0 8px 24px rgba(37,99,235,0.22)" }}>{user?.name?.[0]}</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#0F172A" }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{user?.email}</div>
          <div style={{ marginTop: 10 }}><span className="badge-success">Administrator</span></div>
        </div>
        <div style={{ padding: "1rem" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, paddingLeft: 4 }}>Quick Info</div>
          <div style={{ fontSize: 13, color: "#374151", padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>
            <div><b>Role:</b> Admin</div>
            <div style={{ marginTop: 4 }}><b>Agents:</b> {agents.length}</div>
            <div style={{ marginTop: 4 }}><b>Properties:</b> {properties.length}</div>
          </div>
        </div>
      </div>

      {/* Settings panels */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Account */}
        <div className="section-card">
          <SectionHeader icon={User} title="Account Settings" />
          <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div><label className="form-label">Full Name</label><input className="form-input" defaultValue={user?.name} /></div>
            <div><label className="form-label">Email</label><input className="form-input" defaultValue={user?.email} disabled style={{ opacity: 0.6 }} /></div>
            <div style={{ gridColumn: "span 2" }}>
              <button className="btn-primary" style={{ justifyContent: "center" }}>Save Account Changes</button>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="section-card">
          <SectionHeader icon={Volume2} title="Notifications & Alerts" />
          <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { label: "Browser Sound Alerts", desc: "Play audio when a visitor sends a message", state: notifSounds, set: setNotifSounds },
              { label: "In-Dashboard Banners", desc: "Show visual pop-up alerts for new activity", state: notifBanners, set: setNotifBanners },
            ].map(({ label, desc, state, set }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid #E5E7EB" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{desc}</div>
                </div>
                <button
                  onClick={() => set(!state)}
                  style={{ width: 44, height: 24, borderRadius: 12, border: "none", background: state ? "#2563EB" : "#CBD5E1", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}
                >
                  <span style={{ position: "absolute", top: 3, left: state ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="section-card">
          <SectionHeader icon={Settings} title="Change Password" />
          <div style={{ padding: "1.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ gridColumn: "span 2" }}><label className="form-label">Current Password</label><input className="form-input" type="password" placeholder="••••••••" /></div>
            <div><label className="form-label">New Password</label><input className="form-input" type="password" placeholder="••••••••" /></div>
            <div><label className="form-label">Confirm New Password</label><input className="form-input" type="password" placeholder="••••••••" /></div>
            <div style={{ gridColumn: "span 2" }}>
              <button className="btn-primary" style={{ justifyContent: "center" }}>Update Password</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Main layout ── */
  return (
    <div style={{ display: "flex", height: "100vh", background: "#F8FAFC" }}>
      <ConnectionBanner down={down} />

      {/* Mobile overlay */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 49, backdropFilter: "blur(2px)" }} />}

      {/* Sidebar */}
      <aside data-open={sidebarOpen} style={{ width: 260, background: "#0F172A", display: "flex", flexDirection: "column", zIndex: 50, flexShrink: 0 }}>
        <div style={{ padding: "1.5rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: "-0.02em" }}>Chattrix</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600, textTransform: "uppercase" }}>Admin Panel</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "0.75rem" }}>
          {navItems.map(item => (
            <button key={item.name} onClick={() => { setActiveTab(item.name); setSidebarOpen(false); }} className={`nav-item${activeTab === item.name ? " active" : ""}`} style={{ marginBottom: 4, width: "100%" }}>
              <item.icon size={17} />
              <span>{item.name}</span>
              {item.name === "Live Chats" && activeChats > 0 && (
                <span style={{ marginLeft: "auto", background: "#2563EB", color: "#fff", fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{activeChats}</span>
              )}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>{user?.name?.[0]}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Administrator</div>
            </div>
          </div>
          <button onClick={onLogout} className="btn-danger" style={{ width: "100%", justifyContent: "center" }}><LogOut size={14} /> Sign Out</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 64, background: "#fff", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.5rem", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen(v => !v)} className="mobile-menu-btn" style={{ width: 36, height: 36, border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Menu size={18} color="#64748B" />
            </button>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", lineHeight: 1 }}>{activeTab}</h2>
              <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 1 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={load} title="Refresh data" style={{ width: 36, height: 36, border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={16} color="#64748B" />
            </button>
            <button style={{ position: "relative", width: 36, height: 36, border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Bell size={16} color="#64748B" />
              {activeChats > 0 && <span style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, background: "#2563EB", borderRadius: "50%", border: "2px solid #fff" }} />}
            </button>
            <div onClick={() => setActiveTab("Settings")} style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#2563EB,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }} title="Settings">
              {user?.name?.[0]}
            </div>
          </div>
        </header>

        {/* Toast notification */}
        <AnimatePresence>
          {formMsg.text && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              style={{ position: "fixed", top: 76, right: 20, zIndex: 1000, padding: "12px 20px", borderRadius: 12, background: formMsg.ok ? "#10B981" : "#EF4444", color: "#fff", fontWeight: 700, fontSize: 13, boxShadow: "0 8px 24px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
              {formMsg.ok ? <CheckCircle2 size={16} /> : "⚠"} {formMsg.text}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          <div style={{ maxWidth: 1440, margin: "0 auto" }}>
            {activeTab === "Dashboard"   && renderDashboard()}
            {activeTab === "Live Chats"  && renderLiveChats()}
            {activeTab === "Agents"      && renderAgents()}
            {activeTab === "Properties"  && renderProperties()}
            {activeTab === "Settings"    && renderSettings()}
          </div>
        </div>
      </main>

      <style>{`
        .mobile-menu-btn { display: none !important; }
        @media (max-width: 1023px) {
          .mobile-menu-btn { display: flex !important; }
          aside {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
          }
          aside[data-open="true"] { transform: translateX(0) !important; }
        }
      `}</style>
    </div>
  );
}
