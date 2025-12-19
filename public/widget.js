// ===============================
// MCP POPUP CHAT WIDGET (RIGHT-BOTTOM FLOATING)
// ===============================
(function () {
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');

  const MCP_URL =
    scriptEl?.getAttribute("data-server") || "https://localhost:3000/chat";

  const TITLE =
    scriptEl?.getAttribute("data-title") || "WooCommerce Copilot Assistant";









  const CLIENT_KEY = scriptEl?.getAttribute("data-client-key") || null;

  // simple per browser session id for wizards
  let SESSION_ID = localStorage.getItem("mcp_session_id");
  if (!SESSION_ID) {
    SESSION_ID = "sess_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("mcp_session_id", SESSION_ID);
  }












  document.addEventListener("DOMContentLoaded", function () {
    // ===============================
    //           STYLES
    // ===============================
    const style = document.createElement("style");
    style.textContent = `/* =============================
   TOGGLE BUTTON
   ============================= */
#mcp-toggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: radial-gradient(circle at 20% 0%, #22c55e 0%, #16a34a 40%, #059669 100%);
  width: 64px;
  height: 64px;
  border-radius: 999px;
  box-shadow: 0 18px 35px rgba(15, 23, 42, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  cursor: pointer;
  z-index: 99998;
  color: white;
  transition: transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease;
}
#mcp-toggle:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.95);
  filter: brightness(1.05);
}

/* =============================
   MAIN POPUP
   ============================= */
#chat-widget,
#chat-widget * {
  box-sizing: border-box;
}

#chat-widget {
  position: fixed;
  bottom: 96px;
  right: 20px;
  width: 380px;
  max-height: 600px;
  display: none;
  flex-direction: column;
  background: radial-gradient(circle at top, #020617 0%, #020617 40%, #020617 100%);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9);
  border-radius: 18px;
  overflow: hidden;
  z-index: 99999;
  border: 1px solid rgba(55, 65, 81, 0.8);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #e5e7eb;
}

/* Wide mode */
#chat-widget.wide {
  width: 760px;
  max-height: 80vh;
  right: 20px;
  bottom: 40px;
}
#chat-widget.wide .message .message-content {
  max-width: 92%;
}

/* Mobile fallback for wide mode */
@media (max-width: 840px) {
  #chat-widget.wide {
    width: 95vw;
    right: 2.5vw;
    left: auto;
  }
}

/* =============================
   HEADER
   ============================= */
.chat-header {
  background: linear-gradient(
    135deg,
    rgba(15, 23, 42, 0.98),
    rgba(15, 23, 42, 0.98)
  );
  padding: 14px 16px;
  color: #f9fafb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(55, 65, 81, 0.9);
}

.header-content {
  display: flex;
  gap: 10px;
  align-items: center;
}

.header-icon {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: radial-gradient(circle at 20% 0%, #22c55e 0%, #16a34a 40%, #059669 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.5);
  animation: float 3s infinite;
}

.header-title h1 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.header-title p {
  margin: 0;
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.7;
}

.header-controls {
  display: flex;
  gap: 6px;
}

.header-btn {
  width: 26px;
  height: 26px;
  background: rgba(31, 41, 55, 0.9);
  border: 1px solid rgba(55, 65, 81, 0.9);
  border-radius: 999px;
  color: #e5e7eb;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s ease, transform 0.08s ease, border-color 0.12s ease;
}
.header-btn:hover {
  background: rgba(31, 41, 55, 1);
  border-color: rgba(148, 163, 184, 0.9);
  transform: translateY(-1px);
}

/* =============================
   MESSAGES AREA
   ============================= */
#chat-messages {
  flex: 1;
  padding: 14px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  background: radial-gradient(circle at top, #020617 0%, #020617 50%, #020617 100%);
}

#chat-messages::-webkit-scrollbar {
  width: 6px;
}
#chat-messages::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4b5563, #6b7280);
  border-radius: 999px;
}

/* message container */
.message {
  display: flex;
  gap: 8px;
  animation: slideIn 0.25s ease-out;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  background: #0f172a;
  border: 1px solid rgba(55, 65, 81, 0.9);
}

/* avatar variants */
.message.user .message-avatar {
  background: radial-gradient(circle at 20% 0%, #0ea5e9 0%, #0284c7 50%, #0369a1 100%);
  border: 1px solid rgba(59, 130, 246, 0.8);
}
.message.assistant .message-avatar {
  background: radial-gradient(circle at 20% 0%, #22c55e 0%, #16a34a 40%, #059669 100%);
  border: 1px solid rgba(34, 197, 94, 0.7);
}

/* bubble */
.message-content {
  max-width: 75%;
  padding: 9px 13px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.45;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* user bubble */
.message.user .message-content {
  background: radial-gradient(circle at 20% 0%, #0ea5e9 0%, #0284c7 45%, #0369a1 100%);
  color: #ecfeff;
  border-bottom-right-radius: 4px;
  white-space: pre-wrap;
  box-shadow: 0 10px 25px rgba(8, 47, 73, 0.7);
}

/* assistant bubble */
.message.assistant .message-content {
  background: #020617;
  border: 1px solid rgba(51, 65, 85, 0.9);
  color: #e5e7eb;
  border-bottom-left-radius: 4px;
  white-space: normal;
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.8);
}

.message.assistant .message-content a {
  color: #38bdf8;
  text-decoration: underline;
}

/* debug bubble (assistant) */
.message.assistant.debug .message-content {
  background: #020617;
  border: 1px dashed rgba(148, 163, 184, 0.7);
  font-size: 11px;
  color: #cbd5f5;
  padding: 7px 11px;
  border-radius: 10px;
}

/* =============================
   TYPING INDICATOR
   ============================= */
.typing-indicator {
  display: flex;
  gap: 4px;
  background: #020617;
  border: 1px solid rgba(55, 65, 81, 0.9);
  padding: 8px 12px;
  border-radius: 14px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #6b7280;
  animation: bounce 1.4s infinite;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

/* =============================
   FOOTER / INPUT
   ============================= */
.chat-footer {
  padding: 10px 12px 11px;
  background: #020617;
  display: flex;
  gap: 8px;
  border-top: 1px solid rgba(31, 41, 55, 0.9);
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #020617;
  border: 1px solid rgba(55, 65, 81, 0.9);
  border-radius: 999px;
  padding: 0 12px;
}

#message-input {
  flex: 1;
  border: none;
  background: transparent;
  color: #e5e7eb;
  padding: 9px 0;
  outline: none;
  font-size: 14px;
}

#message-input::placeholder {
  color: #6b7280;
}

#send-btn {
  width: 36px;
  height: 36px;
  border-radius: 999px;
  border: none;
  background: radial-gradient(circle at 20% 0%, #22c55e 0%, #16a34a 40%, #059669 100%);
  cursor: pointer;
  color: #f9fafb;
  font-size: 16px;
  box-shadow: 0 12px 24px rgba(22, 163, 74, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.1s ease;
}
#send-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

/* =============================
   ANIMATIONS
   ============================= */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-5px);
  }
}

/* =============================
   CONFIRM MODAL – CHATGPT STYLE
   ============================= */
.mcp-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100000;
}

/* main card */
.mcp-confirm-modal {
  width: min(480px, 92vw);
  max-height: 80vh;
  background: radial-gradient(circle at top, #020617 0%, #020617 55%, #020617 100%);
  border-radius: 16px;
  border: 1px solid rgba(55, 65, 81, 0.9);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9);
  padding: 18px 20px 14px;
  display: flex;
  flex-direction: column;
  color: #e5e7eb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

/* inner layout */
.mcp-confirm-body {
  flex: 1;
  overflow: hidden;
}

/* title */
.mcp-confirm-title {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #f9fafb;
}

/* description line under title */
.mcp-confirm-description {
  margin: 2px 0 6px;
  font-size: 13px;
  color: #9ca3af;
}

/* summary block with scroll */
.mcp-confirm-summary {
  margin-top: 6px;
  padding-top: 8px;
  padding-bottom: 10px;
  border-top: 1px solid rgba(55, 65, 81, 0.9);
  border-bottom: 1px solid rgba(31, 41, 55, 0.8);
  font-size: 13px;
  line-height: 1.55;
  max-height: 260px;
  overflow-y: auto;
}

.mcp-confirm-summary div {
  margin-bottom: 4px;
}
.mcp-confirm-summary strong {
  font-weight: 600;
  color: #f9fafb;
}

/* status selector area */
.mcp-confirm-status-section {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed rgba(75, 85, 99, 0.8);
}

.mcp-confirm-status-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #cbd5f5;
}

.mcp-confirm-status-select {
  border-radius: 999px;
  padding: 7px 12px;
  border: 1px solid rgba(99, 102, 241, 0.9);
  background: #020617;
  color: #e5e7ff;
  font-size: 13px;
  outline: none;
}

/* footer buttons */
.mcp-confirm-footer {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* base button */
.mcp-confirm-btn {
  border: none;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.08s ease, box-shadow 0.15s ease;
}

/* cancel */
.mcp-confirm-btn.cancel {
  background: #020617;
  color: #e5e7eb;
  border: 1px solid rgba(55, 65, 81, 0.9);
}
.mcp-confirm-btn.cancel:hover {
  background: #020617;
  border-color: rgba(148, 163, 184, 0.9);
  transform: translateY(-1px);
}

/* confirm */
.mcp-confirm-btn.confirm {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: #f9fafb;
  box-shadow: 0 0 0 1px rgba(22, 163, 74, 0.6), 0 14px 28px rgba(22, 163, 74, 0.4);
}
.mcp-confirm-btn.confirm:hover {
  background: linear-gradient(135deg, #4ade80, #22c55e);
  transform: translateY(-1px);
}

/* nice dark scrollbar for confirm summary */
.mcp-confirm-summary::-webkit-scrollbar {
  width: 6px;
}

.mcp-confirm-summary::-webkit-scrollbar-track {
  background: #020617;
}

.mcp-confirm-summary::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, #4b5563, #6b7280);
  border-radius: 999px;
}

/* Firefox */
.mcp-confirm-summary {
  scrollbar-width: thin;
  scrollbar-color: #4b5563 #020617;
}

/* small screens */
@media (max-width: 640px) {
  .mcp-confirm-modal {
    width: 94vw;
    padding-inline: 16px;
  }
}`;
    document.head.appendChild(style);

    // ===============================
    //           HTML
    // ===============================
    const widget = document.createElement("div");
    widget.id = "chat-widget";
    widget.innerHTML = `
      <div class="chat-header">
        <div class="header-content">
          <div class="header-icon">🤖</div>
          <div class="header-title">
            <h1>${TITLE}</h1>
            <p>Your smart WooCommerce assistant</p>
          </div>
        </div>
        <div class="header-controls">
          <button class="header-btn" id="clear-chat">🗑</button>
          <button class="header-btn" id="resize-chat">🗖</button>
          <button class="header-btn" id="close-chat">✖</button>
        </div>
      </div>

      <div id="chat-messages"></div>

      <div class="chat-footer">
        <div class="input-wrapper">
          <input id="message-input" placeholder="Type a message..." />
        </div>
        <button id="send-btn">➤</button>
      </div>
    `;
    document.body.appendChild(widget);

    const toggle = document.createElement("div");
    toggle.id = "mcp-toggle";
    toggle.innerHTML = "💬";
    document.body.appendChild(toggle);

    // ===============================
    // ELEMENTS
    // ===============================
    const messagesDiv = document.getElementById("chat-messages");
    const inputField = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-chat");
    const closeBtn = document.getElementById("close-chat");
    const resizeBtn = document.getElementById("resize-chat");

    // user preference: pinned wide?
    let pinnedWide = false;

    // confirmation overlay reference
    let wizardConfirmOverlay = null;

    // ===============================
    // FUNCTIONS
    // ===============================
    function scrollToBottom() {
      setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }, 50);
    }

    // helper to extract wizard confirm meta from assistant text
    function extractWizardConfirmMeta(text) {
      const start = text.indexOf("[[WIZARD_CONFIRM_META]]");
      const end = text.indexOf("[[END_WIZARD_CONFIRM_META]]");

      if (start === -1 || end === -1 || end <= start) {
        return { cleanText: text, meta: null };
      }

      const before = text.slice(0, start).trimEnd();
      const metaRaw = text
        .slice(start + "[[WIZARD_CONFIRM_META]]".length, end)
        .trim();
      const after = text
        .slice(end + "[[END_WIZARD_CONFIRM_META]]".length)
        .trim();

      let meta = null;
      try {
        meta = JSON.parse(metaRaw);
      } catch (e) {
        console.error("Failed to parse wizard confirm meta", e);
      }

      const cleanParts = [];
      if (before) cleanParts.push(before);
      if (after) cleanParts.push(after);
      const cleanText = cleanParts.join("\n\n");

      return { cleanText, meta };
    }

    function addMessageToDOM(textOrHtml, isUser, isHtmlForAssistant = false) {
      let finalText = textOrHtml;
      let meta = null;

      // only assistant messages might contain wizard confirm meta
      if (!isUser && typeof textOrHtml === "string") {
        const extracted = extractWizardConfirmMeta(textOrHtml);
        finalText = extracted.cleanText;
        meta = extracted.meta;
      }

      const wrap = document.createElement("div");
      wrap.className = `message ${isUser ? "user" : "assistant"}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.textContent = isUser ? "👤" : "🤖";

      const bubble = document.createElement("div");
      bubble.className = "message-content";

      if (isUser) {
        bubble.textContent = finalText;
      } else {
        if (
          isHtmlForAssistant ||
          (typeof finalText === "string" &&
            /<\/?[a-z][\s\S]*>/i.test(finalText))
        ) {
          bubble.innerHTML = finalText;
        } else {
          bubble.textContent = finalText;
        }
      }

      if (isUser) {
        wrap.appendChild(bubble);
        wrap.appendChild(avatar);
      } else {
        wrap.appendChild(avatar);
        wrap.appendChild(bubble);
      }

      messagesDiv.appendChild(wrap);
      scrollToBottom();

      // if we got wizard confirm meta, open confirmation modal
      if (meta && meta.type === "wizard_confirm") {
        openWizardConfirmModal(meta);
      }
    }

    function saveHistory() {
      const msgs = [];
      document.querySelectorAll(".message").forEach((m) => {
        const bubble = m.querySelector(".message-content");
        msgs.push({
          isUser: m.classList.contains("user"),
          content: m.classList.contains("user")
            ? bubble.textContent
            : bubble.innerHTML,
          html: !m.classList.contains("user"),
        });
      });
      localStorage.setItem("mcp-chat-history", JSON.stringify(msgs));
    }

    function loadHistory() {
      const saved = localStorage.getItem("mcp-chat-history");
      if (!saved) {
        addMessageToDOM(
          "👋 Hello! Ask me anything about your store.",
          false,
          false
        );
        return;
      }
      try {
        JSON.parse(saved).forEach((m) =>
          addMessageToDOM(m.content, m.isUser, !!m.html)
        );
      } catch {
        addMessageToDOM(
          "👋 Hello! Ask me anything about your store.",
          false,
          false
        );
      }
    }

    function showTyping() {
      const wrap = document.createElement("div");
      wrap.className = "message assistant";
      wrap.id = "typing-indicator";
      wrap.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
      messagesDiv.appendChild(wrap);
      scrollToBottom();
    }

    function hideTyping() {
      document.getElementById("typing-indicator")?.remove();
    }

    function mcpEscapeHtml(str) {
      if (str == null) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // confirmation modal helpers
    function closeWizardConfirmModal() {
      if (wizardConfirmOverlay && wizardConfirmOverlay.parentNode) {
        wizardConfirmOverlay.parentNode.removeChild(wizardConfirmOverlay);
      }
      wizardConfirmOverlay = null;
    }

    function openWizardConfirmModal(meta) {
      // Overlay container
      const overlay = document.createElement("div");
      overlay.className = "mcp-confirm-overlay";
      wizardConfirmOverlay = overlay;

      const modal = document.createElement("div");
      modal.className = "mcp-confirm-modal";

      const body = document.createElement("div");
      body.className = "mcp-confirm-body";

      // ---- title and action ----
      let title = "Confirm action";
      if (
        meta.wizard === "create_product" &&
        (meta.action === "create" || meta.action === "create_from_json")
      ) {
        title = "Confirm new product";
      } else if (meta.wizard === "update_product" && meta.action === "update") {
        title = "Confirm product update";
      }

      const description = meta.description || "";

      // ---- labels for fields ----
      const labelMap = {
        regular_price: "Regular price",
        sale_price: "Sale price",
        status: "Status",
        sku: "SKU",
        stock_quantity: "Stock quantity",
        stock_status: "Stock status",
        manage_stock: "Manage stock",
        categories: "Categories",
        tags: "Tags",
        description: "Description",
        short_description: "Short description",
        virtual: "Virtual",
        downloadable: "Downloadable",
        weight: "Weight",
        dimensions: "Dimensions",
        backorders: "Backorders",
        low_stock_amount: "Low stock amount",
        sold_individually: "Sold individually",
        featured: "Featured",
        catalog_visibility: "Catalog visibility",
        reviews_allowed: "Reviews allowed",
        purchase_note: "Purchase note",
        external_url: "External URL",
        button_text: "Button text",
        meta_data: "Meta data"
      };

      const summary = meta.summary || {};

      const rowsHtml = Object.entries(summary)
        .filter(
          ([_, v]) =>
            v !== null && v !== undefined && v !== "" && v !== "(none)"
        )
        .map(([key, value]) => {
          const label =
            labelMap[key] ||
            key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
          return `<div><strong>${mcpEscapeHtml(
            label
          )}:</strong> ${mcpEscapeHtml(String(value))}</div>`;
        })
        .join("");

      // ---- base HTML (description + name + all non empty fields) ----
      body.innerHTML = `
        <div class="mcp-confirm-title">${mcpEscapeHtml(title)}</div>
        ${
          description
            ? `<div class="mcp-confirm-description">${mcpEscapeHtml(
                description
              )}</div>`
            : ""
        }
        <div class="mcp-confirm-summary">
          <div><strong>Name:</strong> ${mcpEscapeHtml(
            meta.productName || "(missing)"
          )}</div>
          ${rowsHtml}
        </div>
      `;

      // ---- status select for create/create_from_json ----
      if (
        meta.wizard === "create_product" &&
        (meta.action === "create" || meta.action === "create_from_json")
      ) {
        const statusSection = document.createElement("div");
        statusSection.className = "mcp-confirm-status-section";
        statusSection.innerHTML = `
          <label class="mcp-confirm-status-label">
            Status
            <select id="mcp-status-select" class="mcp-confirm-status-select">
              <option value="publish" ${
                meta.summary?.status === "publish" ? "selected" : ""
              }>Publish</option>
              <option value="draft" ${
                meta.summary?.status === "draft" ? "selected" : ""
              }>Draft</option>
            </select>
          </label>
        `;
        body.appendChild(statusSection);
      }

      const footer = document.createElement("div");
      footer.className = "mcp-confirm-footer";

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "Cancel";
      cancelBtn.className = "mcp-confirm-btn cancel";

      const confirmBtn = document.createElement("button");
      confirmBtn.textContent = "Confirm";
      confirmBtn.className = "mcp-confirm-btn confirm";

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // ---- events ----
      cancelBtn.addEventListener("click", () => {
  // Always tell the server to cancel the current wizard
  sendMessage("cancel");
  closeWizardConfirmModal();
});


      confirmBtn.addEventListener("click", () => {
        if (
          meta.wizard === "create_product" &&
          (meta.action === "create" || meta.action === "create_from_json")
        ) {
          const select = overlay.querySelector("#mcp-status-select");
          const status =
            select &&
            (select.value === "draft" || select.value === "publish")
              ? select.value
              : "publish";

          if (meta.action === "create_from_json") {
            sendMessage(`__JSON_CONFIRM__:${status}`);
          } else {
            sendMessage(`__WIZ_CONFIRM__:${status}`);
          }
        } else if (meta.wizard === "update_product" && meta.action === "update") {
          sendMessage("confirm");
        } else {
          sendMessage("confirm");
        }

        closeWizardConfirmModal();
      });
    }

    // ===============================
    // SEND MESSAGE
    // ===============================
    async function sendMessage(overrideText) {
      const msg =
        overrideText !== undefined
          ? String(overrideText).trim()
          : inputField.value.trim();
      if (!msg) return;

      addMessageToDOM(msg, true);
      saveHistory();

      if (overrideText === undefined) {
        inputField.value = "";
      }

      showTyping();





      try {
        const res = await fetch(MCP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            clientKey: CLIENT_KEY   // ← IMPORTANT
          }),
        });
  



        hideTyping();

        if (!res.ok) {
          addMessageToDOM("⚠️ Server error: " + res.status, false);
          return;
        }

        const json = await res.json();

        if (json.text) {
          addMessageToDOM(json.text, false, true);
        }

        if (json.debug) {
          addMessageToDOM(
            `
  <div style="
    padding:8px 12px;
    margin-top:4px;
    border-left:3px solid #c792ea;
    background:rgba(255,255,255,0.05);
    border-radius:8px;
  ">
    <div style="font-weight:bold; font-size:12px; color:#c792ea; margin-bottom:4px;">
      DEBUG BLOCK
    </div>
    <pre style="font-size:11px; color:#bfc7ff; white-space:pre-wrap;">
${json.debug}
    </pre>
  </div>
  `,
            false,
            true
          );
        }

        if (!json.text && !json.debug) {
          addMessageToDOM("[Invalid response format]", false);
        }

        saveHistory();
      } catch (err) {
        hideTyping();
        addMessageToDOM("❌ Could not reach server.", false);
      }
    }

    // ===============================
    // WIDE MODE
    // ===============================
    resizeBtn.addEventListener("click", () => {
      const nowWide = !widget.classList.contains("wide");
      widget.classList.toggle("wide", nowWide);
      pinnedWide = nowWide;
    });

    messagesDiv.addEventListener(
      "toggle",
      (e) => {
        const t = e.target;
        if (!(t instanceof HTMLDetailsElement)) return;

        if (t.open) {
          widget.classList.add("wide");
          setTimeout(
            () => t.scrollIntoView({ block: "nearest", behavior: "smooth" }),
            50
          );
        } else {
          const anyOpen = messagesDiv.querySelector("details[open]");
          if (!anyOpen && !pinnedWide) widget.classList.remove("wide");
        }
      },
      true
    );

    // ===============================
    // CLEAR & CLOSE
    // ===============================
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear chat history?")) return;
      messagesDiv.innerHTML = "";
      localStorage.removeItem("mcp-chat-history");
    });

    closeBtn.addEventListener("click", () => {
      widget.style.display = "none";
      toggle.style.display = "flex";
    });

    toggle.addEventListener("click", () => {
      widget.style.display = "flex";
      toggle.style.display = "none";
    });

    sendBtn.addEventListener("click", () => sendMessage());
    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendMessage();
    });

    // ===============================
    // INIT
    // ===============================
    loadHistory();
  });
})();
