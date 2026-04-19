import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Loader2 } from "lucide-react";

export default function ConnectionBanner({ down }) {
  return (
    <AnimatePresence>
      {down && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          style={{
            position: "fixed", top: 16, left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999, width: "90%", maxWidth: 420,
          }}
        >
          <div style={{
            background: "#FFFFFF",
            border: "1.5px solid rgba(239,68,68,0.3)",
            borderRadius: 14,
            padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            boxShadow: "0 8px 24px rgba(239,68,68,0.15)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(239,68,68,0.10)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <WifiOff size={18} color="#EF4444" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
                  Connection Lost
                </div>
                <div style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, marginTop: 1 }}>
                  Reconnecting to server...
                </div>
              </div>
            </div>
            <Loader2 size={18} color="#EF4444" className="animate-spin" style={{ flexShrink: 0 }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
