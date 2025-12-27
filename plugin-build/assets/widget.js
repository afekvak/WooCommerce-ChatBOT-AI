// public/widget.js
// Loads widget.css then injects widget.html markup inline, then loads widget.runtime.js
(function () {
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');

  const MCP_URL =
    scriptEl?.getAttribute("data-server") || "https://localhost:3000/chat";

  const TITLE =
    scriptEl?.getAttribute("data-title") || "WooCommerce Copilot Assistant";

  const CLIENT_KEY = scriptEl?.getAttribute("data-client-key") || null;

  const src = scriptEl?.getAttribute("src") || "";
  const base = src.split("?")[0].replace(/\/widget\.js$/, "");

  const ver = (src.split("?")[1] || "").trim();
  const qs = ver ? `?${ver}` : "";

  // Config consumed by widget.runtime.js
  window.__MCP_WIDGET_CONFIG__ = {
    MCP_URL,
    TITLE,
    CLIENT_KEY,
    ASSET_BASE: base,
  };

  function ensureCss() {
    return new Promise((resolve) => {
      const id = "mcp-widget-css";
      if (document.getElementById(id)) return resolve(true);

      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `${base}/widget.css${qs}`;
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
  }

  function ensureHtml() {
    // prevent double mount
    if (document.getElementById("mcp-widget-mount")) return true;

    const mount = document.createElement("div");
    mount.id = "mcp-widget-mount";

    // Inline version of your widget.html
    mount.innerHTML = `
<div id="chat-widget">
  <div class="chat-header">
    <div class="header-content">
      <div class="header-icon">🤖</div>
      <div class="header-title">
        <h1 id="mcp-title">WooCommerce Copilot Assistant</h1>
        <p>Your smart WooCommerce assistant</p>
      </div>
    </div>
    <div class="header-controls">
      <button class="header-btn" id="clear-chat" type="button">🗑</button>
      <button class="header-btn" id="resize-chat" type="button">🗖</button>
      <button class="header-btn" id="close-chat" type="button">✖</button>
    </div>
  </div>

  <div id="chat-messages"></div>

  <div class="chat-footer">
    <div class="input-wrapper">
      <input id="message-input" placeholder="Type a message..." />
    </div>
    <button id="send-btn" type="button">➤</button>
  </div>
</div>

<div id="mcp-toggle">💬</div>
    `.trim();

    document.body.appendChild(mount);

    const titleNode = document.getElementById("mcp-title");
    if (titleNode) titleNode.textContent = TITLE;

    return true;
  }

  function ensureRuntime() {
    return new Promise((resolve) => {
      const id = "mcp-widget-runtime";
      if (document.getElementById(id)) return resolve(true);

      const s = document.createElement("script");
      s.id = id;
      s.src = `${base}/widget.runtime.js${qs}`;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function boot() {
    await ensureCss();
    const okHtml = ensureHtml();
    if (!okHtml) {
      console.error("Failed to mount widget HTML");
      return;
    }

    const okRuntime = await ensureRuntime();
    if (!okRuntime) console.error("Failed to load widget.runtime.js");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
