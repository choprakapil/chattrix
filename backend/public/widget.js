(function () {
  "use strict";
  var scriptTag = document.currentScript;
  if (!scriptTag) return;
  var propertyId = scriptTag.getAttribute("data-property-id");
  if (!propertyId) return;
  var base = new URL(scriptTag.src).origin;

  /* ── Load socket.io lazily ── */
  var socketScript = document.createElement("script");
  socketScript.src = base + "/socket.io/socket.io.js";
  socketScript.async = true;
  socketScript.onload = init;
  document.head.appendChild(socketScript);

  /* ── Google Fonts: Inter ── */
  var fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(fontLink);

  function init() {
    var key = "chattrix_" + propertyId;
    var state = { chatId: null };

    /* ── Root container ── */
    var root = document.createElement("div");
    root.id = "chattrix-root";
    root.style.cssText = [
      "position:fixed",
      "right:20px",
      "bottom:20px",
      "z-index:2147483647",
      "font-family:'Inter',system-ui,sans-serif",
      "display:flex",
      "flex-direction:column",
      "align-items:flex-end",
      "gap:10px",
    ].join(";");
    document.body.appendChild(root);

    /* ── Floating button ── */
    var fab = document.createElement("button");
    fab.id = "chattrix-fab";
    fab.innerHTML = svgChat();
    fab.title = "Chat with us";
    fab.setAttribute("aria-label", "Open chat");
    fab.style.cssText = [
      "width:58px",
      "height:58px",
      "border-radius:50%",
      "border:none",
      "cursor:pointer",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "background:linear-gradient(135deg,#2563EB,#7C3AED)",
      "box-shadow:0 8px 24px rgba(37,99,235,0.35)",
      "color:#fff",
      "transition:transform 0.2s ease,box-shadow 0.2s ease",
      "flex-shrink:0",
    ].join(";");
    fab.onmouseenter = function () {
      fab.style.transform = "scale(1.08)";
      fab.style.boxShadow = "0 12px 32px rgba(37,99,235,0.42)";
    };
    fab.onmouseleave = function () {
      fab.style.transform = "scale(1)";
      fab.style.boxShadow = "0 8px 24px rgba(37,99,235,0.35)";
    };
    root.appendChild(fab);

    /* ── Panel ── */
    var panel = document.createElement("div");
    panel.id = "chattrix-panel";
    panel.style.cssText = [
      "display:none",
      "width:min(360px,calc(100vw - 40px))",
      "height:520px",
      "background:#FFFFFF",
      "border-radius:16px",
      "border:1px solid #E5E7EB",
      "box-shadow:0 16px 48px rgba(15,23,42,0.14)",
      "overflow:hidden",
      "flex-direction:column",
    ].join(";");
    root.insertBefore(panel, fab);

    /* ── Socket connection ── */
    var socket = window.io(base, { 
      path: "/chat/socket.io",
      reconnection: true, 
      transports: ["polling"] 
    });
    var typingTimer;

    /* ── HTML Escape ── */
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (m) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m];
      });
    }

    /* ── SVG icons ── */
    function svgChat() {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    }
    function svgClose() {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    }
    function svgSend() {
      return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    }

    /* ── Panel Header ── */
    function panelHeader(subtitle) {
      return (
        '<div style="background:linear-gradient(135deg,#2563EB,#7C3AED);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;color:#fff">' +
              svgChat() +
            "</div>" +
            '<div>' +
              '<div style="font-size:15px;font-weight:700;color:#fff;line-height:1">Chattrix</div>' +
              '<div style="font-size:11px;color:rgba(255,255,255,0.75);margin-top:2px">' + esc(subtitle || "Smarter Live Chat") + "</div>" +
            "</div>" +
          "</div>" +
          '<button id="cx-close" aria-label="Close chat" style="background:rgba(255,255,255,0.12);border:none;cursor:pointer;color:#fff;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;transition:background 0.15s ease">' +
            svgClose() +
          "</button>" +
        "</div>"
      );
    }

    /* ── Pre-chat form ── */
    function renderPreChat() {
      panel.style.display = "flex";
      panel.innerHTML =
        panelHeader("Start a conversation") +
        '<div style="flex:1;overflow-y:auto;padding:16px">' +
          '<form id="cx-form">' +
            field("Name", "text", "cx-name", "Your full name", true) +
            field("Email", "email", "cx-email", "email@example.com", true) +
            field("Phone", "tel", "cx-phone", "+1 555 000 0000", true) +
            '<div style="margin-bottom:12px">' +
              '<label style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:5px">Message</label>' +
              '<textarea id="cx-message" required placeholder="How can we help?" style="width:100%;height:88px;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:13px;font-family:inherit;color:#0F172A;resize:none;outline:none;box-sizing:border-box;transition:border-color 0.15s ease"></textarea>' +
            "</div>" +
            '<button type="submit" style="width:100%;padding:11px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(37,99,235,0.28);transition:opacity 0.15s ease">Start Chat</button>' +
          "</form>" +
          '<div style="text-align:center;margin-top:12px;font-size:11px;color:#94A3B8">Design by Kapil Chopra</div>' +
        "</div>";

      /* focus styles */
      panel.querySelectorAll("input,textarea,select").forEach(function (el) {
        el.addEventListener("focus", function () { el.style.borderColor = "#2563EB"; el.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; });
        el.addEventListener("blur",  function () { el.style.borderColor = "#E5E7EB"; el.style.boxShadow = "none"; });
      });

      panel.querySelector("#cx-close").onclick = togglePanel;

      panel.querySelector("#cx-form").onsubmit = function (e) {
        e.preventDefault();
        var btn = panel.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = "Starting...";

        var phoneVal = panel.querySelector("#cx-phone").value.trim();
        var codeVal = panel.querySelector("#cx-code") ? panel.querySelector("#cx-code").value : "";
        var fullPhone = codeVal ? (codeVal + " " + phoneVal) : phoneVal;

        var payload = {
          property_id: propertyId,
          name: panel.querySelector("#cx-name").value.trim(),
          email: panel.querySelector("#cx-email").value.trim(),
          phone: fullPhone,
          message: panel.querySelector("#cx-message").value.trim(),
        };
        var apiUrl = base + "/api/chat/start";

        console.log("[Chattrix Widget] ── Form payload:", payload);
        console.log("[Chattrix Widget] property_id:", propertyId);
        console.log("[Chattrix Widget] API URL:", apiUrl);

        fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (r) {
            console.log("[Chattrix Widget] Response status:", r.status, r.statusText);
            return r.json().then(function (json) {
              console.log("[Chattrix Widget] Response JSON:", JSON.stringify(json));
              if (!r.ok) throw new Error(json.error || ("HTTP " + r.status));
              return json;
            });
          })
          .then(function (d) {
            console.log("[Chattrix Widget] ✓ Chat started, chat_id:", d.chat_id);
            state.chatId = d.chat_id;
            localStorage.setItem(key, JSON.stringify({
              chatId: d.chat_id,
              name: panel.querySelector("#cx-name").value,
              email: panel.querySelector("#cx-email").value,
              phone: panel.querySelector("#cx-phone").value,
            }));
            socket.emit("visitor_join", { chatId: d.chat_id });
            renderChat();
            loadMessages();
          })
          .catch(function (err) {
            console.error("[Chattrix Widget] ✗ Chat start failed:", err.message);
            btn.disabled = false;
            btn.textContent = "Start Chat";
            showError("Unable to start chat: " + err.message);
          });
      };
    }

    function field(label, type, id, placeholder, required) {
      if (id === "cx-phone") {
        var countries = [
          { code: "+91", label: "IN" },
          { code: "+1", label: "US" },
          { code: "+44", label: "UK" },
          { code: "+61", label: "AU" },
          { code: "+971", label: "AE" },
          { code: "+65", label: "SG" },
          { code: "+49", label: "DE" },
          { code: "+33", label: "FR" },
          { code: "+81", label: "JP" },
        ];
        var options = countries.map(function(c) {
          return '<option value="' + c.code + '"' + (c.code === "+91" ? " selected" : "") + ">" + c.label + " " + c.code + "</option>";
        }).join("");

        return (
          '<div style="margin-bottom:12px">' +
            '<label for="' + id + '" style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:5px">' + label + (required ? ' <span style="color:#EF4444">*</span>' : "") + "</label>" +
            '<div style="display:flex;gap:6px">' +
              '<select id="cx-code" style="width:85px;padding:9px 6px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:13px;font-family:inherit;color:#0F172A;outline:none;background:#fff;cursor:pointer;transition:border-color 0.15s ease">' + options + "</select>" +
              '<input id="' + id + '" type="' + type + '" placeholder="9876543210"' + (required ? " required" : "") + ' style="flex:1;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:13px;font-family:inherit;color:#0F172A;outline:none;box-sizing:border-box;transition:border-color 0.15s ease,box-shadow 0.15s ease" />' +
            "</div>" +
          "</div>"
        );
      }

      return (
        '<div style="margin-bottom:12px">' +
          '<label for="' + id + '" style="display:block;font-size:12px;font-weight:600;color:#64748B;margin-bottom:5px">' + label + (required ? ' <span style="color:#EF4444">*</span>' : "") + "</label>" +
          '<input id="' + id + '" type="' + type + '" placeholder="' + placeholder + '"' + (required ? " required" : "") + ' style="width:100%;padding:9px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:13px;font-family:inherit;color:#0F172A;outline:none;box-sizing:border-box;transition:border-color 0.15s ease,box-shadow 0.15s ease" />' +
        "</div>"
      );
    }

    /* ── Chat interface ── */
    function renderChat() {
      panel.style.display = "flex";
      panel.innerHTML =
        panelHeader("Live conversation") +
        '<div id="cx-status" style="padding:6px 14px;background:#F8FAFC;border-bottom:1px solid #E5E7EB;font-size:11px;font-weight:600;color:#64748B;flex-shrink:0">● Connected</div>' +
        '<div id="cx-msgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;background:#F8FAFC"></div>' +
        '<div id="cx-typing" style="min-height:20px;padding:0 14px 2px;font-size:11px;color:#64748B;flex-shrink:0"></div>' +
        '<form id="cx-send" style="display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E5E7EB;background:#FFFFFF;flex-shrink:0">' +
          '<input id="cx-input" placeholder="Type a message..." style="flex:1;padding:9px 14px;border:1.5px solid #E5E7EB;border-radius:999px;font-size:13px;font-family:inherit;color:#0F172A;outline:none;min-width:0;transition:border-color 0.15s ease,box-shadow 0.15s ease" />' +
          '<button type="submit" aria-label="Send" style="width:38px;height:38px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#2563EB,#7C3AED);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px rgba(37,99,235,0.28);transition:opacity 0.15s">' +
            svgSend() +
          "</button>" +
        "</form>";

      /* focus on input */
      var inp = panel.querySelector("#cx-input");
      inp.addEventListener("focus",  function () { inp.style.borderColor = "#2563EB"; inp.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; });
      inp.addEventListener("blur",   function () { inp.style.borderColor = "#E5E7EB"; inp.style.boxShadow = "none"; });

      panel.querySelector("#cx-close").onclick = togglePanel;

      panel.querySelector("#cx-send").onsubmit = function (e) {
        e.preventDefault();
        var message = inp.value.trim();
        if (!message) return;
        socket.emit("new_message", { chatId: state.chatId, sender: "visitor", message: message });
        inp.value = "";
        socket.emit("stop_typing", { chatId: state.chatId, sender: "visitor" });
      };

      inp.addEventListener("input", function () {
        socket.emit("typing", { chatId: state.chatId, sender: "visitor" });
        clearTimeout(typingTimer);
        typingTimer = setTimeout(function () {
          socket.emit("stop_typing", { chatId: state.chatId, sender: "visitor" });
        }, 1500);
      });
    }

    /* ── Add message bubble ── */
    function addMsg(m) {
      var wrap = panel.querySelector("#cx-msgs");
      if (!wrap) return;
      var isVisitor = m.sender === "visitor";
      var row = document.createElement("div");
      row.style.cssText = "display:flex;flex-direction:column;align-items:" + (isVisitor ? "flex-end" : "flex-start");

      var time = m.created_at || m.timestamp || Date.now();
      var timeStr = new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

      row.innerHTML =
        '<div style="' +
          "max-width:80%;padding:9px 12px;border-radius:" + (isVisitor ? "16px 16px 4px 16px" : "16px 16px 16px 4px") + ";" +
          "background:" + (isVisitor ? "#2563EB" : "#E2E8F0") + ";" +
          "color:" + (isVisitor ? "#FFFFFF" : "#0F172A") + ";" +
          "font-size:13px;line-height:1.5;" +
          "box-shadow:" + (isVisitor ? "0 2px 8px rgba(37,99,235,0.20)" : "0 1px 4px rgba(15,23,42,0.08)") + ";" +
        '">' +
          '<div>' + esc(m.message) + "</div>" +
          '<div style="font-size:10px;margin-top:4px;opacity:0.65;text-align:right">' + timeStr + "</div>" +
        "</div>";
      wrap.appendChild(row);
      wrap.scrollTop = wrap.scrollHeight;
    }

    /* ── Notification badge on FAB ── */
    function setBadge(count) {
      var existing = root.querySelector("#cx-badge");
      if (count > 0) {
        if (!existing) {
          var badge = document.createElement("div");
          badge.id = "cx-badge";
          badge.style.cssText = "position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#EF4444;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:2px solid #fff";
          fab.style.position = "relative";
          fab.appendChild(badge);
          existing = badge;
        }
        existing.textContent = count > 9 ? "9+" : count;
      } else if (existing) {
        existing.remove();
      }
    }
    var unreadCount = 0;

    /* ── Load messages ── */
    function loadMessages() {
      fetch(base + "/api/chat/" + state.chatId + "/messages")
        .then(function (r) { return r.json(); })
        .then(function (msgs) {
          var wrap = panel.querySelector("#cx-msgs");
          if (wrap) { wrap.innerHTML = ""; msgs.forEach(addMsg); }
          socket.emit("message_read", { chatId: state.chatId, reader: "visitor" });
        });
    }

    /* ── Show error ── */
    function showError(msg) {
      panel.style.display = "flex";
      panel.innerHTML =
        panelHeader("Status") +
        '<div style="flex:1;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:24px">' +
          '<div style="color:#EF4444;font-size:14px;font-weight:600;text-align:center">' + esc(msg) + "</div>" +
          '<button onclick="this.closest(\'#chattrix-panel\').style.display=\'none\'" style="padding:8px 20px;background:#F1F5F9;border:1px solid #E5E7EB;border-radius:8px;font-size:13px;font-weight:600;color:#64748B;cursor:pointer;font-family:inherit">Close</button>' +
        "</div>";
    }

    /* ── Toggle panel ── */
    function togglePanel() {
      var isHidden = panel.style.display === "none" || !panel.style.display;
      if (isHidden) {
        panel.style.display = "flex";
        fab.innerHTML = svgClose();
        unreadCount = 0;
        setBadge(0);
        if (!state.chatId) {
          socket.emit("visitor_opened_chat", { propertyId: propertyId });
          renderPreChat();
        }
      } else {
        panel.style.display = "none";
        fab.innerHTML = svgChat();
      }
    }

    fab.onclick = togglePanel;

    /* ── Socket events ── */
    socket.on("connect", function () {
      socket.emit("join_property", { propertyId: propertyId });
      /* Load greeting */
      fetch(base + "/api/widget/property/" + propertyId)
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.custom_greeting) fab.title = d.custom_greeting; })
        .catch(function () {});
      /* Resume session */
      var saved = localStorage.getItem(key);
      if (saved) {
        try {
          var parsed = JSON.parse(saved);
          fetch(base + "/api/chat/" + parsed.chatId + "/status")
            .then(function (r) { return r.json(); })
            .then(function (s) {
              if (s.status === "closed") {
                localStorage.removeItem(key);
              } else {
                state.chatId = parsed.chatId;
                renderChat();
                panel.style.display = "flex";
                fab.innerHTML = svgClose();
                socket.emit("visitor_join", { chatId: state.chatId });
                loadMessages();
              }
            });
        } catch (e) { localStorage.removeItem(key); }
      }
    });

    socket.on("disconnect", function () {
      var statusEl = panel.querySelector("#cx-status");
      if (statusEl) {
        statusEl.textContent = "⟳ Reconnecting...";
        statusEl.style.color = "#F59E0B";
      }
    });

    socket.on("new_message", function (m) {
      addMsg(m);
      if (panel.style.display === "none" || !panel.style.display) {
        unreadCount++;
        setBadge(unreadCount);
      }
    });

    socket.on("typing", function (d) {
      var el = panel.querySelector("#cx-typing");
      if (d.sender === "agent" && el) {
        el.innerHTML =
          '<div style="display:flex;align-items:center;gap:6px">' +
            '<span style="display:flex;gap:3px">' +
              '<span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;animation:cx-bounce 1.2s infinite ease-in-out"></span>' +
              '<span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;animation:cx-bounce 1.2s 0.2s infinite ease-in-out"></span>' +
              '<span style="width:5px;height:5px;border-radius:50%;background:#94A3B8;animation:cx-bounce 1.2s 0.4s infinite ease-in-out"></span>' +
            "</span>" +
            '<span style="font-size:11px;color:#64748B;font-weight:500">Agent is typing...</span>' +
          "</div>";
      }
    });

    socket.on("stop_typing", function () {
      var el = panel.querySelector("#cx-typing");
      if (el) el.innerHTML = "";
    });

    socket.on("chat_ended", function () {
      localStorage.removeItem(key);
      state.chatId = null;
      showError("This chat session has ended. Thank you for contacting us!");
    });

    /* ── Inject animation keyframes ── */
    var style = document.createElement("style");
    style.textContent = "@keyframes cx-bounce{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-5px);opacity:1}}";
    document.head.appendChild(style);
  }
})();
