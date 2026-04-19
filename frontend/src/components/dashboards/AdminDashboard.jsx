import { useEffect, useRef, useState, useCallback } from "react";
import { api } from "../../lib/api";
import ConnectionBanner from "../ConnectionBanner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Globe,
  MessageSquare,
  Settings,
  LayoutDashboard,
  LogOut,
  Plus,
  Clipboard,
  Bell,
  Search,
  Menu,
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
  UserPlus,
  MessageCircle,
  TrendingUp,
  RefreshCw,
  LineChart as LineChartIcon,
  User,
  Mail,
  Key,
  Volume2,
  Trash2,
  ShieldCheck,
  Calendar
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";

/* ─── Stat Card ──────────────────────────────────────────── */
const StatCard = ({ title, value, icon: Icon, gradient }) => (
  <motion.div whileHover={{ y: -3 }} className="stat-card">
    <div style={{
      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 6px 18px rgba(37,99,235,0.18)",
    }}>
      <Icon size={24} color="#fff" />
    </div>
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", lineHeight: 1 }}>
        {value}
      </div>
    </div>
  </motion.div>
);

/* ─── Section Header ─────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, title, badge }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid #E5E7EB",
    background: "#FAFAFA",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: "linear-gradient(135deg,#2563EB,#7C3AED)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={16} color="#fff" />
      </div>
      <span style={{ fontWeight: 700, fontSize: 15, color: "#0F172A" }}>{title}</span>
    </div>
    {badge && (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: "3px 10px",
        borderRadius: 999, background: "#EFF6FF", color: "#2563EB",
        border: "1px solid #BFDBFE",
      }}>
        {badge}
      </span>
    )}
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
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [copied, setCopied] = useState(null);
  const [formMsg, setFormMsg] = useState({ text: "", ok: true });
  const messagesEndRef = useRef(null);
  const selectedChatRef = useRef(null);

  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [stats, setStats] = useState({ totalVisitors: 0, activeChats: 0, agentsOnline: 0, avgResponse: "0s", trend: [] });

  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);

  const load = useCallback(async () => {
    try {
      const qParams = new URLSearchParams();
      if (dateRange.from) qParams.append("from", dateRange.from);
      if (dateRange.to) qParams.append("to", dateRange.to);

      const [a, p, ass, c, s] = await Promise.all([
        api("/api/admin/agents").catch((e) => { console.error("[Admin] agents:", e.message); return []; }),
        api("/api/admin/properties").catch((e) => { console.error("[Admin] properties:", e.message); return []; }),
        api("/api/admin/assignments").catch((e) => { console.error("[Admin] assignments:", e.message); return []; }),
        api(`/api/admin/chats?${qParams.toString()}`).catch((e) => { console.error("[Admin] chats:", e.message); return []; }),
        api(`/api/admin/stats?${qParams.toString()}`).catch((e) => { console.error("[Admin] stats:", e.message); return {}; }),
      ]);
      setAgents(Array.isArray(a) ? a : []);
      setProperties(Array.isArray(p) ? p : []);
      setAssignments(Array.isArray(ass) ? ass : []);
      if (s && !s.trend) s.trend = [];
      setStats(s || { totalVisitors: 0, activeChats: 0, agentsOnline: 0, avgResponse: "0s", trend: [] });
      const chatList = Array.isArray(c) ? c : [];
      setAllChats(chatList);
      setChats(chatList);
    } catch (e) {
      console.error("[Admin] load failed:", e);
    }
  }, [dateRange]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onUpdate = () => { load(); };
    const onNewMsg = (m) => {
      if (selectedChatRef.current === m.chatId) {
        setMessages((prev) => [...prev, m]);
      }
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let filtered = allChats;
    if (statusFilter) filtered = filtered.filter((c) => c.status === statusFilter);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      filtered = filtered.filter((c) =>
        (c.visitor_name || "").toLowerCase().includes(q) ||
        (c.visitor_email || "").toLowerCase().includes(q) ||
        (c.property_name || "").toLowerCase().includes(q)
      );
    }
    setChats(filtered);
  }, [searchQ, statusFilter, allChats]);

  const createAgent = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/agents", { method: "POST", body: JSON.stringify(agentForm) });
      setAgentForm({ name: "", username: "", password: "" });
      setFormMsg({ text: "Agent created!", ok: true });
      load();
    } catch (err) {
      setFormMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setFormMsg({ text: "", ok: true }), 3000);
  };

  const createProperty = async (e) => {
    e.preventDefault();
    try {
      await api("/api/admin/properties", { method: "POST", body: JSON.stringify(propForm) });
      setPropForm({ name: "", url: "" });
      setFormMsg({ text: "Property created!", ok: true });
      load();
    } catch (err) {
      setFormMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setFormMsg({ text: "", ok: true }), 3000);
  };

  const assignAgents = async (e) => {
    e.preventDefault();
    if (!assign.propertyDbId) return;
    try {
      await api("/api/admin/assign", {
        method: "POST",
        body: JSON.stringify({ propertyDbId: Number(assign.propertyDbId), agentIds: assign.agentIds.map(Number) }),
      });
      setAssign({ propertyDbId: "", agentIds: [] });
      setFormMsg({ text: "Agents assigned!", ok: true });
      load();
    } catch (err) {
      setFormMsg({ text: err.message, ok: false });
    }
    setTimeout(() => setFormMsg({ text: "", ok: true }), 3000);
  };

  const openChat = async (chatId) => {
    setSelectedChat(chatId);
    try {
      const msgs = await api(`/api/admin/chats/${chatId}/messages`);
      setMessages(Array.isArray(msgs) ? msgs : []);
      socket?.emit("agent_join", { chatId });
    } catch (err) {
      setMessages([]);
    }
  };

  const copyEmbed = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const activeChats = allChats.filter((c) => c?.status !== "closed").length;
  
  const navItems = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Live Chats", icon: MessageSquare },
    { name: "Agents", icon: Users },
    { name: "Properties", icon: Globe },
    { name: "Settings", icon: Settings },
  ];

  /* ── Tab Renderers ── */
  const renderDashboard = () => {
    const trendData = stats.trend && stats.trend.length > 0 ? stats.trend : [{ name: "No Data", chats: 0 }];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1rem" }}>
          <StatCard title="Active Chats" value={stats.activeChats} icon={MessageSquare} gradient="linear-gradient(135deg,#2563EB,#3B82F6)" />
          <StatCard title="Total Visitors" value={stats.totalVisitors} icon={TrendingUp} gradient="linear-gradient(135deg,#7C3AED,#9333EA)" />
          <StatCard title="Agents Online" value={stats.agentsOnline} icon={Users} gradient="linear-gradient(135deg,#059669,#22C55E)" />
          <StatCard title="Avg Response" value={stats.avgResponse} icon={Clock} gradient="linear-gradient(135deg,#D97706,#F59E0B)" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "1.25rem", alignItems: "stretch" }}>
          <div className="section-card" style={{ padding: "1.5rem" }}>
            <SectionHeader icon={TrendingUp} title="Message Volume Trend" />
            <div style={{ height: 320, width: "100%", marginTop: "1rem" }}>
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
                  <Area type="monotone" dataKey="chats" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorChats)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="section-card">
            <SectionHeader icon={Calendar} title="Filter Period" />
            <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div><label className="form-label">From Date</label><input type="date" className="form-input" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} /></div>
              <div><label className="form-label">To Date</label><input type="date" className="form-input" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} /></div>
              <button className="btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={load}>Update Analytics</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLiveChats = () => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,380px)", gap: "1.25rem", alignItems: "start" }}>
      <div className="section-card" style={{ display: "flex", flexDirection: "column", height: 700 }}>
        <div style={{ background: "linear-gradient(135deg,#2563EB,#7C3AED)", padding: "1rem 1.25rem", flexShrink: 0 }}>
          {selectedChat ? (
            <div>
              {(() => {
                const c = allChats.find(x => x.id === selectedChat);
                return (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{c?.visitor_name || `Chat #${selectedChat}`}</div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.2)", color: "#fff", textTransform: "uppercase" }}>{c?.property_name || "Property"}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          ) : <div style={{ color: "#fff", fontWeight: 700 }}>Message Transcript</div>}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem", display: "flex", flexDirection: "column", gap: 10, background: "#F8FAFC" }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: m.sender === "visitor" ? "flex-end" : "flex-start" }}>
              <div className={m.sender === "visitor" ? "msg-visitor" : "msg-agent"} style={{ maxWidth: "80%" }}>{m.message}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="section-card" style={{ display: "flex", flexDirection: "column", maxHeight: 700 }}>
        <SectionHeader icon={MessageSquare} title="Recent Inquiries" />
        <div style={{ padding: "0.75rem", borderBottom: "1px solid #F1F5F9" }}>
          <input className="form-input" placeholder="Search..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {chats.map((c) => (
            <button key={c.id} onClick={() => openChat(c.id)} style={{ width: "100%", padding: "1rem", border: "none", background: selectedChat === c.id ? "#EFF6FF" : "transparent", borderBottom: "1px solid #F1F5F9", textAlign: "left", cursor: "pointer" }}>
              <div style={{ fontWeight: 800 }}>{c.visitor_name}</div>
              <div style={{ fontSize: 12, color: "#64748B" }}>{c.last_message || "No messages"}</div>
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
        {agents.map((a) => (
          <div key={a.id} style={{ padding: "1rem", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
            <span>{a.name} (@{a.username})</span>
            <span className={a.status === "online" ? "badge-success" : "badge-neutral"}>{a.status}</span>
          </div>
        ))}
      </div>
      <div className="section-card" style={{ height: "fit-content" }}>
        <SectionHeader icon={UserPlus} title="Add New Agent" />
        <form onSubmit={createAgent} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Name</label><input className="form-input" value={agentForm.name} onChange={e => setAgentForm({...agentForm, name: e.target.value})} required /></div>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Username</label><input className="form-input" value={agentForm.username} onChange={e => setAgentForm({...agentForm, username: e.target.value})} required /></div>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Password</label><input className="form-input" type="password" value={agentForm.password} onChange={e => setAgentForm({...agentForm, password: e.target.value})} required /></div>
          <button type="submit" className="btn-primary" style={{ width: "100%" }}>Create Agent</button>
        </form>
      </div>
    </div>
  );

  const renderProperties = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "1.25rem" }}>
      <div className="section-card">
        <SectionHeader icon={Globe} title="Websites" />
        {properties.map(p => (
          <div key={p.id} style={{ padding: "1.5rem", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontWeight: 900 }}>{p.name}</div>
            <div style={{ display: "flex", gap: 10, background: "#F8FAFC", padding: 12, marginTop: 10, borderRadius: 12 }}>
              <code style={{ fontSize: 11, flex: 1 }}>{p.embedScript}</code>
              <button className="btn-primary" style={{ padding: "4px 8px", fontSize: 10 }} onClick={() => copyEmbed(p.embedScript, p.id)}>{copied === p.id ? "Copied" : "Copy"}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="section-card" style={{ height: "fit-content" }}>
        <SectionHeader icon={Plus} title="Add Website" />
        <form onSubmit={createProperty} style={{ padding: "1.5rem" }}>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">Name</label><input className="form-input" value={propForm.name} onChange={e => setPropForm({...propForm, name: e.target.value})} required /></div>
          <div style={{ marginBottom: "1rem" }}><label className="form-label">URL</label><input className="form-input" value={propForm.url} onChange={e => setPropForm({...propForm, url: e.target.value})} required /></div>
          <button type="submit" className="btn-primary" style={{ width: "100%" }}>Add Property</button>
        </form>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "1.25rem" }}>
      <div className="section-card" style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#2563EB", margin: "0 auto 1rem", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 30, fontWeight: 900 }}>{user?.name[0]}</div>
        <div style={{ fontWeight: 800 }}>{user?.name}</div>
        <div style={{ fontSize: 13, color: "#64748B" }}>{user?.email}</div>
      </div>
      <div className="section-card" style={{ padding: "1.5rem" }}>
        <SectionHeader icon={User} title="Account Settings" />
        <div style={{ marginTop: "1rem" }}>
          <label className="form-label">Full Name</label>
          <input className="form-input" defaultValue={user?.name} />
          <button className="btn-primary" style={{ marginTop: "1rem" }}>Save Changes</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "#F8FAFC" }}>
      <ConnectionBanner down={down} />
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 49 }} />}
      <aside style={{ width: 260, background: "#0F172A", display: "flex", flexDirection: "column", zIndex: 50 }}>
        <div style={{ padding: "2rem 1.5rem", color: "#fff", fontSize: 20, fontWeight: 900 }}>Chattrix</div>
        <nav style={{ flex: 1, padding: "1rem" }}>
          {navItems.map(item => (
            <button key={item.name} onClick={() => { setActiveTab(item.name); setSidebarOpen(false); }} className={`nav-item ${activeTab === item.name ? "active" : ""}`}>
              <item.icon size={18} /> {item.name}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem" }}>
          <button onClick={onLogout} className="btn-danger" style={{ width: "100%" }}><LogOut size={16} /> Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header style={{ height: 64, background: "#fff", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ display: "none" }}><Menu /></button>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{activeTab}</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
            <button onClick={load} title="Refresh"><RefreshCw size={18} /></button>
            <Bell size={18} />
          </div>
        </header>
        <AnimatePresence>
          {formMsg.text && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} style={{ position: "fixed", top: 80, right: 20, background: formMsg.ok ? "#10B981" : "#EF4444", color: "#fff", padding: "10px 20px", borderRadius: 8, zIndex: 1000 }}>{formMsg.text}</motion.div>
          )}
        </AnimatePresence>
        <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
          {activeTab === "Dashboard" && renderDashboard()}
          {activeTab === "Live Chats" && renderLiveChats()}
          {activeTab === "Agents" && renderAgents()}
          {activeTab === "Properties" && renderProperties()}
          {activeTab === "Settings" && renderSettings()}
        </div>
      </main>
      <style>{`
        .mobile-menu-btn { display: none; }
        @media (max-width: 1023px) {
          .mobile-menu-btn { display: block !important; }
          aside { position: fixed; transform: translateX(-100%); transition: transform 0.3s; }
          aside[data-open="true"] { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
