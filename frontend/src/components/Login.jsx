import { useState } from "react";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Mail, User, MessageSquare, ChevronRight, Loader2, Zap } from "lucide-react";

export default function Login({ onLogin }) {
  const [type, setType] = useState("admin");
  const [form, setForm] = useState({ email: "", username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = type === "admin" ? "/api/auth/admin/login" : "/api/auth/agent/login";
      const body = type === "admin"
        ? { email: form.email, password: form.password }
        : { username: form.username, password: form.password };
      const data = await api(url, { method: "POST", body: JSON.stringify(body) });
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "#F8FAFC",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Blobs */}
      <div style={{
        position: "absolute", top: "-80px", left: "-80px",
        width: "400px", height: "400px",
        background: "rgba(37,99,235,0.08)", borderRadius: "50%",
        filter: "blur(80px)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: "-80px", right: "-80px",
        width: "400px", height: "400px",
        background: "rgba(124,58,237,0.07)", borderRadius: "50%",
        filter: "blur(80px)", pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}
      >
        <div style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "20px",
          boxShadow: "0 16px 48px rgba(15,23,42,0.10)",
          padding: "2.5rem",
        }}>
          {/* Logo */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <div style={{
              width: "64px", height: "64px", borderRadius: "16px",
              background: "linear-gradient(135deg,#2563EB,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 1rem",
              boxShadow: "0 8px 24px rgba(37,99,235,0.25)",
            }}>
              <MessageSquare style={{ color: "#fff", width: 28, height: 28 }} />
            </div>
            <h1 style={{
              fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.03em",
              background: "linear-gradient(135deg,#2563EB,#7C3AED)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: "4px",
            }}>
              Chattrix
            </h1>
            <p style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>
              Smarter Live Chat for Modern Businesses.
            </p>
          </div>

          {/* Type Toggle */}
          <div className="toggle-pill" style={{ marginBottom: "1.75rem" }}>
            <button
              type="button"
              onClick={() => setType("admin")}
              className={type === "admin" ? "active-pill" : ""}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setType("agent")}
              className={type === "agent" ? "active-pill" : ""}
            >
              Agent
            </button>
          </div>

          {/* Form */}
          <form onSubmit={submit}>
            <div style={{ marginBottom: "1rem" }}>
              <label className="form-label">
                {type === "admin" ? "Admin Email" : "Agent Username"}
              </label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "12px", top: "50%",
                  transform: "translateY(-50%)", color: "#94A3B8",
                  display: "flex", alignItems: "center",
                }}>
                  {type === "admin" ? <Mail size={16} /> : <User size={16} />}
                </div>
                <input
                  className="form-input"
                  style={{ paddingLeft: "38px" }}
                  placeholder={type === "admin" ? "admin@chattrix.com" : "agent_username"}
                  value={type === "admin" ? form.email : form.username}
                  onChange={(e) => setForm({ ...form, [type === "admin" ? "email" : "username"]: e.target.value })}
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", left: "12px", top: "50%",
                  transform: "translateY(-50%)", color: "#94A3B8",
                  display: "flex", alignItems: "center",
                }}>
                  <Lock size={16} />
                </div>
                <input
                  className="form-input"
                  style={{ paddingLeft: "38px" }}
                  type="password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#DC2626",
                    fontSize: "13px",
                    fontWeight: 600,
                    padding: "10px 14px",
                    borderRadius: "10px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "1rem",
                  }}
                >
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: "#EF4444", flexShrink: 0,
                  }} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%", padding: "0.75rem", borderRadius: "12px", fontSize: "15px", justifyContent: "center" }}
            >
              {loading ? (
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div style={{ marginTop: "1.75rem", textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "6px",
              padding: "5px 14px", borderRadius: "999px",
              background: "rgba(37,99,235,0.06)",
              border: "1px solid rgba(37,99,235,0.12)",
            }}>
              <Zap size={11} style={{ color: "#2563EB" }} />
              <span style={{ fontSize: "11px", color: "#64748B", fontWeight: 600 }}>
                Secured with enterprise-grade encryption
              </span>
            </div>
            <p className="footer-credit" style={{ marginTop: "1rem" }}>
              Design by Kapil Chopra
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
