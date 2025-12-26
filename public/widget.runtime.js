// public/widget.runtime.js
(function () {
  const cfg = window.__MCP_WIDGET_CONFIG__ || {};
  const MCP_URL = cfg.MCP_URL || "https://localhost:3000/chat";
  const TITLE = cfg.TITLE || "WooCommerce Copilot Assistant";
  const CLIENT_KEY = cfg.CLIENT_KEY || null;

  let SESSION_ID = localStorage.getItem("mcp_session_id");
  if (!SESSION_ID) {
    SESSION_ID = "sess_" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("mcp_session_id", SESSION_ID);
  }

  function init() {
    const widget = document.getElementById("chat-widget");
    const toggle = document.getElementById("mcp-toggle");

    const messagesDiv = document.getElementById("chat-messages");
    const inputField = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const clearBtn = document.getElementById("clear-chat");
    const closeBtn = document.getElementById("close-chat");
    const resizeBtn = document.getElementById("resize-chat");

    if (!widget || !toggle || !messagesDiv || !inputField || !sendBtn) {
      console.error("Widget mount failed: missing DOM nodes");
      return;
    }

    const titleNode = document.getElementById("mcp-title");
    if (titleNode) titleNode.textContent = TITLE;

    let pinnedWide = false;

    function applyUiSettings(ui) {
  if (!ui) return;

  // Theme
  if (ui.theme === "light") {
    widget.classList.add("mcp-theme-light");
  } else {
    widget.classList.remove("mcp-theme-light");
  }

  // Scale
  if (typeof ui.scale === "number" && isFinite(ui.scale) && ui.scale > 0) {
    widget.style.transform = `scale(${ui.scale})`;
    widget.style.transformOrigin = "bottom right";

    toggle.style.transform = `scale(${ui.scale})`;
    toggle.style.transformOrigin = "bottom right";
  } else {
    widget.style.transform = "";
    toggle.style.transform = "";
  }

  // Default wide
  if (ui.defaultWide === true) {
    widget.classList.add("wide");
    pinnedWide = true;
  }
}



    let wizardConfirmOverlay = null;

    function scrollToBottom() {
      setTimeout(() => {
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }, 50);
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

    function addMessageToDOM(textOrHtml, isUser, isHtmlForAssistant = false) {
      if (
        !isUser &&
        typeof textOrHtml === "string" &&
        textOrHtml.includes("[[INTRO_BREAK]]")
      ) {
        const parts = textOrHtml.split("[[INTRO_BREAK]]");

        const introPart = parts[0].trim();
        const bodyPart = parts.slice(1).join("[[INTRO_BREAK]]").trim();

        if (introPart) {
          addMessageToDOM(introPart, false, false);
        }

        if (bodyPart) {
          addMessageToDOM(bodyPart, false, true);
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
      avatar.textContent = isUser ? "👤" : "🤖";

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

      messagesDiv.appendChild(wrap);
      scrollToBottom();

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
        addMessageToDOM("👋 Hello! Ask me anything about your store.", false, false);
        return;
      }
      try {
        JSON.parse(saved).forEach((m) => addMessageToDOM(m.content, m.isUser, !!m.html));
      } catch {
        addMessageToDOM("👋 Hello! Ask me anything about your store.", false, false);
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

    function closeWizardConfirmModal() {
      if (wizardConfirmOverlay && wizardConfirmOverlay.parentNode) {
        wizardConfirmOverlay.parentNode.removeChild(wizardConfirmOverlay);
      }
      wizardConfirmOverlay = null;
    }

    function openWizardConfirmModal(meta) {
      const overlay = document.createElement("div");
      overlay.className = "mcp-confirm-overlay";
      wizardConfirmOverlay = overlay;

      const modal = document.createElement("div");
      modal.className = "mcp-confirm-modal";

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
            clientKey: CLIENT_KEY,
          }),
        });

        hideTyping();

        if (!res.ok) {
          addMessageToDOM("⚠️ Server error: " + res.status, false);
          return;
        }

        const json = await res.json();

        if (json.ui) {
  applyUiSettings(json.ui);
  try {
    localStorage.setItem("mcp-ui-cache", JSON.stringify(json.ui));
  } catch (e) {}
}


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
          setTimeout(() => t.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
        } else {
          const anyOpen = messagesDiv.querySelector("details[open]");
          if (!anyOpen && !pinnedWide) widget.classList.remove("wide");
        }
      },
      true
    );

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

    try {
  const cachedUi = JSON.parse(localStorage.getItem("mcp-ui-cache") || "null");
  if (cachedUi) applyUiSettings(cachedUi);
} catch (e) {}


    loadHistory();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
