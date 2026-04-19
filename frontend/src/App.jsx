import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API, api } from "./lib/api";
import Login from "./components/Login";
import AdminDashboard from "./components/dashboards/AdminDashboard";
import AgentDashboard from "./components/dashboards/AgentDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [down, setDown] = useState(false);
  const [loading, setLoading] = useState(true);
  // keep a ref so the socket connect callback can always read the latest user
  const userRef = useRef(null);

  useEffect(() => {
    // Step 1: check if already logged in
    api("/api/auth/me")
      .then((d) => {
        console.log("[Chattrix] /me →", d.user);
        userRef.current = d.user;
        setUser(d.user);
      })
      .catch((err) => {
        console.log("[Chattrix] /me → not logged in:", err.message);
      })
      .finally(() => setLoading(false));

    // Step 2: open socket ONCE
    const socketOrigin = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? "http://localhost:3001"
      : window.location.origin;

    const s = io(socketOrigin, {
      path: "/chat/socket.io",
      withCredentials: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ["polling"],
    });

    s.on("connect", () => {
      console.log("[Chattrix] Socket connected:", s.id);
      setDown(false);
      // Use ref so we always have the latest user value even if state hasn't rendered yet
      if (userRef.current) {
        console.log("[Chattrix] register_user →", userRef.current);
        s.emit("register_user", userRef.current);
      }
    });

    s.on("disconnect", (reason) => {
      console.warn("[Chattrix] Socket disconnected:", reason);
      setDown(true);
    });

    s.on("connect_error", (err) => {
      console.error("[Chattrix] Socket connect_error:", err.message);
      setDown(true);
    });

    setSocket(s);
    return () => {
      console.log("[Chattrix] Cleanup: closing socket");
      s.close();
    };
  }, []); // run once on mount

  // Step 3: whenever user first becomes available, register on socket
  useEffect(() => {
    if (socket && user) {
      userRef.current = user;
      console.log("[Chattrix] useEffect register_user →", user);
      socket.emit("register_user", user);
    }
  }, [socket, user]);

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
      console.log("[Chattrix] Logged out");
    } catch (e) {
      console.warn("[Chattrix] Logout error:", e.message);
    }
    userRef.current = null;
    setUser(null);
  };

  // Show nothing while checking session (avoids Login flash)
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#F8FAFC",
        fontFamily: "'Inter',sans-serif", color: "#64748B", fontSize: 14,
      }}>
        Loading Chattrix…
      </div>
    );
  }

  if (!user) return <Login onLogin={(u) => { userRef.current = u; setUser(u); }} />;

  return user.role === "admin"
    ? <AdminDashboard user={user} socket={socket} onLogout={logout} down={down} />
    : <AgentDashboard user={user} socket={socket} onLogout={logout} down={down} />;
}
