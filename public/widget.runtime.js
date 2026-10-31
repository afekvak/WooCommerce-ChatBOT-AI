// public/widget.runtime.js
(function () {
  const cfg = window.__MCP_WIDGET_CONFIG__ || {};
  const MCP_URL = cfg.MCP_URL || "https://localhost:3000/chat";
  const TITLE = cfg.TITLE || "Store assistant";
  const CLIENT_KEY = cfg.CLIENT_KEY || null;

  // ==========================
  // Storage namespacing (prevents mixing users / clientKeys)
  // ==========================
  const STORAGE_NS = `mcp:${CLIENT_KEY || "noKey"}`;
  const KEY_SESSION = `${STORAGE_NS}:session_id`;
  const KEY_CONVERSATION = `${STORAGE_NS}:conversation_id`;
  const CONVERSATIONS_URL = MCP_URL.replace(/\/chat\/?(?:\?.*)?$/, "/conversations");
  let CONVERSATION_ID = localStorage.getItem(KEY_CONVERSATION);
  const KEY_UI = `${STORAGE_NS}:ui_cache`;
  const KEY_THEME = `${STORAGE_NS}:theme`;

  // ==========================
  // Session id (per clientKey)
  // ==========================
  let SESSION_ID = localStorage.getItem(KEY_SESSION);
  if (!SESSION_ID) {
    SESSION_ID = "sess_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem(KEY_SESSION, SESSION_ID);
  }

  function init() {
    const widget = document.getElementById("chat-widget");
    const toggle = document.getElementById("mcp-toggle");

    const messagesDiv = document.getElementById("chat-messages");
    const inputField = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-chat");
    const newChatBtn = document.getElementById("new-chat");
    const headerNewBtn = document.getElementById("header-new-chat");
    const closeBtn = document.getElementById("close-chat");
    const resizeBtn = document.getElementById("resize-chat");
    const chatsBtn = document.getElementById("chats-toggle");
    const sidebar = document.getElementById("chat-sidebar");
    const chatList = document.getElementById("chat-list");
    const sidebarNewBtn = document.getElementById("sidebar-new-chat");
    let listRequest = 0;

    // Optional theme toggle button (if exists in HTML)
    const themeBtn = document.getElementById("theme-toggle");

    if (!widget || !toggle || !messagesDiv || !inputField || !sendBtn) {
      console.error("Widget mount failed: missing DOM nodes");
      return;
    }

    const titleNode = document.getElementById("mcp-title");
    if (titleNode) titleNode.textContent = TITLE;

    const assistantMark = widget.querySelector(".header-icon").innerHTML;
    let pinnedWide = false;

    function setTheme(theme) {
      const t = theme === "light" ? "light" : "dark";
      if (t === "light") widget.classList.add("mcp-theme-light");
      else widget.classList.remove("mcp-theme-light");

      if (themeBtn) {
        themeBtn.setAttribute("aria-label", `Switch to ${t === "light" ? "dark" : "light"} theme`);
        themeBtn.setAttribute("aria-pressed", String(t === "light"));
      }
      try {
        localStorage.setItem(KEY_THEME, t);
      } catch (e) {}
    }

    function toggleTheme() {
      const isLight = widget.classList.contains("mcp-theme-light");
      setTheme(isLight ? "dark" : "light");
    }

    function applyUiSettings(ui) {
      if (!ui) return;

      // Theme from server (optional)
      if (ui.theme === "light") {
        widget.classList.add("mcp-theme-light");
      } else if (ui.theme === "dark") {
        widget.classList.remove("mcp-theme-light");
      }

      // Scale
      if (typeof ui.scale === "number" && isFinite(ui.scale) && ui.scale > 0) {
        const scale = Math.min(1.5, Math.max(0.75, ui.scale));
        widget.style.setProperty("--mcp-scale", String(scale));
        widget.style.transform = `scale(${scale})`;
        toggle.style.transform = `scale(${scale})`;
      } else {
        widget.style.setProperty("--mcp-scale", "1");
        widget.style.transform = "";
        toggle.style.transform = "";
      }

      // Default wide
      if (ui.defaultWide === true) {
        widget.classList.add("wide");
        pinnedWide = true;
      }
    }

    // Load cached UI + theme
    try {
      const cachedUi = JSON.parse(localStorage.getItem(KEY_UI) || "null");
      if (cachedUi) applyUiSettings(cachedUi);
    } catch (e) {}

    try {
      const cachedTheme = localStorage.getItem(KEY_THEME);
      if (cachedTheme === "light" || cachedTheme === "dark") {
        setTheme(cachedTheme);
      }
    } catch (e) {}

    // If you want a default when none cached:
    if (!localStorage.getItem(KEY_THEME)) {
      // Default dark (change to "light" if you want)
      setTheme("dark");
    }

    let wizardConfirmOverlay = null;
    let replayingHistory = false;
    let busy = true;

    function setBusy(value, keepTyping = false) {
      busy = value;
      sendBtn.disabled = value;
      inputField.disabled = value && !keepTyping;
      if (clearBtn) clearBtn.disabled = value;
      if (newChatBtn) newChatBtn.disabled = value;
      if (headerNewBtn) headerNewBtn.disabled = value;
      if (sidebarNewBtn) sidebarNewBtn.disabled = value;
      chatList.querySelectorAll("button").forEach(button => { button.disabled = value; });
    }
    setBusy(true);

    function scrollToBottom() {
      requestAnimationFrame(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      });
    }

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

    function addMessageToDOM(textOrHtml, isUser, isHtmlForAssistant = false, createdAt = replayingHistory ? null : new Date().toISOString()) {
      if (
        !isUser &&
        typeof textOrHtml === "string" &&
        textOrHtml.includes("[[INTRO_BREAK]]")
      ) {
        const parts = textOrHtml.split("[[INTRO_BREAK]]");

        const introPart = parts[0].trim();
        const bodyPart = parts.slice(1).join("[[INTRO_BREAK]]").trim();

        if (introPart) {
          addMessageToDOM(introPart, false, false, createdAt);
        }

        if (bodyPart) {
          addMessageToDOM(bodyPart, false, true, createdAt);
        }

        return;
      }

      let finalText = textOrHtml;
      let meta = null;

      if (!isUser && typeof textOrHtml === "string") {
        const extracted = extractWizardConfirmMeta(textOrHtml);
        finalText = extracted.cleanText;
        meta = extracted.meta;
      }

      const wrap = document.createElement("div");
      wrap.className = `message ${isUser ? "user" : "assistant"}`;

      const avatar = document.createElement("div");
      avatar.className = "message-avatar";
      avatar.innerHTML = isUser ? "" : assistantMark;
      avatar.setAttribute("aria-hidden", "true");

      const bubble = document.createElement("div");
      bubble.className = "message-content";

      if (isUser) {
        bubble.textContent = finalText;
      } else {
        if (
          isHtmlForAssistant ||
          (typeof finalText === "string" && /<\/?[a-z][\s\S]*>/i.test(finalText))
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

      if (createdAt && !String(finalText).includes("mcp-debug")) {
        const date = new Date(createdAt);
        if (!Number.isNaN(date.getTime())) {
          const stamp = document.createElement("time");
          stamp.className = "message-time"; stamp.dateTime = date.toISOString();
          stamp.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          bubble.appendChild(stamp);
        }
      }
      if (createdAt && !String(finalText).includes("mcp-debug")) {
        const date = new Date(createdAt);
        if (!Number.isNaN(date.getTime())) {
          const day = date.toLocaleDateString();
          const datedMessages = messagesDiv.querySelectorAll(".message[data-day]");
          const previous = datedMessages[datedMessages.length - 1];
          if (!previous || previous.dataset.day !== day) {
            const divider = document.createElement("div"); divider.className = "chat-date-divider";
            const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
            divider.textContent = day === today.toLocaleDateString() ? "Today" : day === yesterday.toLocaleDateString() ? "Yesterday" : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
            messagesDiv.appendChild(divider);
          }
          wrap.dataset.day = day;
        }
      }
      messagesDiv.appendChild(wrap);
      scrollToBottom();

      if (!replayingHistory && meta && meta.type === "wizard_confirm") {
        openWizardConfirmModal(meta);
      }
    }

    async function conversationRequest(suffix, body) {
      const response = await fetch(CONVERSATIONS_URL + suffix, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, clientKey: CLIENT_KEY })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.text || "Could not load chat history");
      return data;
    }

    function setSidebar(open) {
      sidebar.hidden = !open;
      widget.classList.toggle("has-sidebar", open);
      chatsBtn.setAttribute("aria-expanded", String(open));
      if (open) refreshChatList();
      else chatsBtn.focus({ preventScroll: true });
    }

    async function refreshChatList() {
      const request = ++listRequest;
      chatList.setAttribute("aria-busy", "true");
      if (!chatList.children.length) chatList.textContent = "Loading chats...";
      try {
        const response = await fetch(CONVERSATIONS_URL, { headers: { "X-MCP-Client-Key": CLIENT_KEY || "" } });
        const data = await response.json();
        if (!response.ok) throw new Error("Could not load chats.");
        if (request !== listRequest) return;
        chatList.replaceChildren();
        if (!data.conversations.length) chatList.textContent = "No saved chats yet.";
        for (const conversation of data.conversations) {
          const button = document.createElement("button"); button.type = "button"; button.className = "chat-list-item";
          button.dataset.conversationId = conversation.id; button.disabled = busy;
          button.setAttribute("aria-current", conversation.id === CONVERSATION_ID ? "page" : "false");
          const title = document.createElement("span"); title.textContent = conversation.title || "New chat";
          const date = document.createElement("time"); const timestamp = new Date(conversation.updated_at);
          if (!Number.isNaN(timestamp.getTime())) { date.dateTime = timestamp.toISOString(); date.textContent = timestamp.toLocaleDateString([], { month: "short", day: "numeric" }); }
          button.append(title, date);
          button.addEventListener("click", async () => {
            if (busy || conversation.id === CONVERSATION_ID) return;
            await loadHistory(false, conversation.id);
            if (matchMedia("(max-width: 640px)").matches) setSidebar(false);
          });
          const row = document.createElement("div"); row.className = "chat-list-row";
          const remove = document.createElement("button"); remove.type = "button"; remove.className = "chat-delete";
          remove.disabled = busy; remove.setAttribute("aria-label", "Delete chat: " + (conversation.title || "New chat")); remove.title = "Delete chat";
          remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg>';
          remove.addEventListener("click", async () => {
            if (busy || !confirm("Delete this chat permanently? Its messages and memories saved from it will also be removed.")) return;
            setBusy(true); ++listRequest;
            try {
              await conversationRequest("/" + conversation.id + "/delete", {});
              if (conversation.id === CONVERSATION_ID) {
                CONVERSATION_ID = null; localStorage.removeItem(KEY_CONVERSATION);
                closeWizardConfirmModal(); messagesDiv.replaceChildren();
                await loadHistory(true);
              }
              await refreshChatList();
            } catch {
              const error = document.createElement("p"); error.setAttribute("role", "alert");
              error.textContent = "Could not delete this chat. Please try again."; chatList.prepend(error);
            } finally { setBusy(false); }
          });
          row.append(button, remove); chatList.appendChild(row);
        }
      } catch {
        if (request !== listRequest) return;
        chatList.replaceChildren();
        const message = document.createElement("p"); message.textContent = "Could not load chats.";
        const retry = document.createElement("button"); retry.type = "button"; retry.className = "sidebar-new"; retry.textContent = "Try again";
        retry.addEventListener("click", refreshChatList); chatList.append(message, retry);
      } finally { if (request === listRequest) chatList.removeAttribute("aria-busy"); }
    }

    async function loadHistory(fresh = false, targetId = null) {
      setBusy(true);
      try {
        const freshSession = "sess_" + Math.random().toString(36).slice(2) + Date.now();
        const data = await conversationRequest("", fresh ? { sessionId: freshSession } : {
          sessionId: SESSION_ID,
          ...((targetId || CONVERSATION_ID) ? { conversationId: targetId || CONVERSATION_ID } : {})
        });
        if (fresh || targetId) closeWizardConfirmModal();
        if (fresh) {
          SESSION_ID = freshSession;
          localStorage.setItem(KEY_SESSION, SESSION_ID);
          closeWizardConfirmModal();
        }
        CONVERSATION_ID = data.conversation.id;
        localStorage.setItem(KEY_CONVERSATION, CONVERSATION_ID);
        // Do not mix old browser-only history with the server's conversation.
        localStorage.removeItem(STORAGE_NS + ":chat_history");
        inputField.value = "";
        inputField.style.height = "";
        messagesDiv.innerHTML = "";
        replayingHistory = true;
        try {
          for (const message of data.messages) {
            addMessageToDOM(message.content, message.role === "user", message.role === "assistant", message.created_at || null);
          }
        } finally { replayingHistory = false; }
        if (!data.messages.length) {
          addMessageToDOM("👋 Hello! Ask me anything about your store.", false, false);
        }
      } catch (error) {
        addMessageToDOM("⚠️ " + error.message, false, false);
      } finally { setBusy(false); if (!sidebar.hidden) refreshChatList(); }
    }

    function showTyping() {
      const wrap = document.createElement("div");
      wrap.className = "message assistant";
      wrap.id = "typing-indicator";
      wrap.innerHTML = `
        <div class="message-avatar" aria-hidden="true">${assistantMark}</div>
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

    function closeWizardConfirmModal() {
      if (wizardConfirmOverlay && wizardConfirmOverlay.parentNode) {
        wizardConfirmOverlay.parentNode.removeChild(wizardConfirmOverlay);
      }
      wizardConfirmOverlay = null;
    }

    function openWizardConfirmModal(meta) {
      const overlay = document.createElement("div");
      overlay.className = "mcp-confirm-overlay";
      overlay.classList.toggle("mcp-theme-light", widget.classList.contains("mcp-theme-light"));
      wizardConfirmOverlay = overlay;

      const modal = document.createElement("div");
      modal.className = "mcp-confirm-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-label", "Confirm store action");

      const body = document.createElement("div");
      body.className = "mcp-confirm-body";

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

      // DO NOT REMOVE: labelMap fields preserved exactly
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
        meta_data: "Meta data",
      };

      const summary = meta.summary || {};

      const rowsHtml = Object.entries(summary)
        .filter(([_, v]) => v !== null && v !== undefined && v !== "" && v !== "(none)")
        .map(([key, value]) => {
          const label =
            labelMap[key] ||
            key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c) => c.toUpperCase());
          return `<div><strong>${mcpEscapeHtml(label)}:</strong> ${mcpEscapeHtml(
            String(value)
          )}</div>`;
        })
        .join("");

      body.innerHTML = `
        <div class="mcp-confirm-title">${mcpEscapeHtml(title)}</div>
        ${
          description
            ? `<div class="mcp-confirm-description">${mcpEscapeHtml(description)}</div>`
            : ""
        }
        <div class="mcp-confirm-summary">
          <div><strong>Name:</strong> ${mcpEscapeHtml(meta.productName || "(missing)")}</div>
          ${rowsHtml}
        </div>
      `;

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
      requestAnimationFrame(() => cancelBtn.focus());
      overlay.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); cancelBtn.click(); }
        if (event.key === "Tab") {
          const items = Array.from(modal.querySelectorAll("button, select"));
          const next = (items.indexOf(document.activeElement) + (event.shiftKey ? -1 : 1) + items.length) % items.length;
          event.preventDefault(); items[next].focus();
        }
      });

      cancelBtn.addEventListener("click", () => {
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
            select && (select.value === "draft" || select.value === "publish")
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

    function focusComposer() {
      if (!wizardConfirmOverlay && !inputField.disabled && widget.getClientRects().length) {
        inputField.focus({ preventScroll: true });
      }
    }

    async function sendMessage(overrideText) {
      if (busy) return;
      const msg =
        overrideText !== undefined
          ? String(overrideText).trim()
          : inputField.value.trim();
      if (!msg) return;
      setBusy(true, true);

      addMessageToDOM(msg, true);

      if (overrideText === undefined) {
        inputField.value = "";
        inputField.style.height = "";
      }

      showTyping();
      requestAnimationFrame(focusComposer);

      try {
        const res = await fetch(MCP_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: msg,
            clientKey: CLIENT_KEY,
            sessionId: SESSION_ID,
            ...(CONVERSATION_ID ? { conversationId: CONVERSATION_ID } : {}),
          }),
        });

        hideTyping();

        const json = await res.json();
        if (!res.ok) {
          addMessageToDOM("⚠️ " + (json.text || "Server error: " + res.status), false, false);
          return;
        }
        if (json.conversationId) {
          CONVERSATION_ID = json.conversationId;
          localStorage.setItem(KEY_CONVERSATION, CONVERSATION_ID);
        }

        if (json.ui) {
          applyUiSettings(json.ui);
          try {
            localStorage.setItem(KEY_UI, JSON.stringify(json.ui));
          } catch (e) {}
        }

        if (json.text) {
          addMessageToDOM(json.text, false, true);
        }

        // The server controls debug visibility through CHAT_DEBUG_BLOCKS.
        if (json.debug) {
          // Optional improvement: wrap debug in <details> so it collapses
          addMessageToDOM(
            `
<details class="mcp-debug"><summary>Debug</summary><pre>${mcpEscapeHtml(json.debug)}</pre></details>
            `,
            false,
            true
          );
        }

        if (!json.text && !json.debug) {
          addMessageToDOM("[Invalid response format]", false);
        }

      } catch (err) {
        hideTyping();
        addMessageToDOM("❌ Could not reach server.", false);
      } finally { setBusy(false); requestAnimationFrame(focusComposer); if (!sidebar.hidden) refreshChatList(); }
    }

    // ==========================
    // UI events
    // ==========================
    chatsBtn.addEventListener("click", () => setSidebar(sidebar.hidden));
    document.getElementById("close-sidebar").addEventListener("click", () => setSidebar(false));
    sidebar.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); setSidebar(false); } });
    sidebarNewBtn.addEventListener("click", async () => { if (!busy) { await loadHistory(true); if (matchMedia("(max-width: 640px)").matches) setSidebar(false); } });
    if (headerNewBtn) headerNewBtn.addEventListener("click", () => { if (!busy) loadHistory(true); });
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => { if (!busy) loadHistory(true); });
    }
    if (resizeBtn) {
      resizeBtn.addEventListener("click", () => {
        const nowWide = !widget.classList.contains("wide");
        widget.classList.toggle("wide", nowWide);
        pinnedWide = nowWide;
      });
    }

    // Chat width changes only through the explicit expand control.

    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        if (busy || !CONVERSATION_ID || !confirm("Delete this conversation's saved messages and memories learned from them?")) return;
        setBusy(true);
        try {
          await conversationRequest("/" + CONVERSATION_ID + "/clear", {});
          closeWizardConfirmModal();
          messagesDiv.innerHTML = "";
          addMessageToDOM("Chat history cleared. Start a new message.", false, false);
          if (!sidebar.hidden) refreshChatList();
        } catch (error) {
          addMessageToDOM("⚠️ " + error.message, false, false);
        } finally { setBusy(false); }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        widget.style.display = "none";
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus({ preventScroll: true });
        toggle.style.display = "flex";
      });
    }

    toggle.addEventListener("click", () => {
      widget.style.display = "grid";
      toggle.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => { scrollToBottom(); inputField.focus({ preventScroll: true }); });
      toggle.style.display = "none";
    });

    inputField.addEventListener("input", () => {
      inputField.style.height = "auto";
      inputField.style.height = Math.min(inputField.scrollHeight, 112) + "px";
    });
    sendBtn.addEventListener("click", () => sendMessage());
    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault(); sendMessage();
      }
    });

    if (themeBtn) {
      themeBtn.addEventListener("click", toggleTheme);
    }

    loadHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
