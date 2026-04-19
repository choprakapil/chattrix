const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
export const API = import.meta.env.VITE_API_URL || (isLocal ? "http://localhost:3001" : "/chat");

export async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}
