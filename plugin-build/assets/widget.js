// public/widget.js
// Loads widget.css then injects widget.html markup inline, then loads widget.runtime.js
(function () {
  const scriptEl =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');

  const MCP_URL =
    scriptEl?.getAttribute("data-server") || "https://localhost:3000/chat";

  const TITLE =
    scriptEl?.getAttribute("data-title") || "Store assistant";

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
    mount.innerHTML = "<section id=\"chat-widget\" role=\"dialog\" aria-label=\"Store assistant\" aria-modal=\"false\">\n  <aside class=\"chat-sidebar\" id=\"chat-sidebar\" aria-label=\"Saved conversations\" hidden>\n    <div class=\"sidebar-heading\"><h2>Your chats</h2><button id=\"close-sidebar\" type=\"button\" class=\"header-btn\" aria-label=\"Close chat list\">&times;</button></div>\n    <button id=\"sidebar-new-chat\" class=\"sidebar-new\" type=\"button\">+ New chat</button>\n    <div id=\"chat-list\" class=\"chat-list\" aria-live=\"polite\"></div>\n  </aside>\n  <header class=\"chat-header\">\n    <div class=\"header-content\">\n      <div class=\"header-icon\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"currentColor\"><path d=\"M12 2c1.4 6.2 3.8 8.6 10 10-6.2 1.4-8.6 3.8-10 10C10.6 15.8 8.2 13.4 2 12c6.2-1.4 8.6-3.8 10-10Z\"/></svg></div>\n      <div class=\"header-title\">\n        <h1 id=\"mcp-title\">Store assistant</h1>\n        <p>Your WooCommerce workspace</p>\n      </div>\n    </div>\n    <div class=\"header-controls\">\n      <button class=\"header-btn\" id=\"chats-toggle\" type=\"button\" title=\"Your chats\" aria-label=\"Your chats\" aria-controls=\"chat-sidebar\" aria-expanded=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" aria-hidden=\"true\"><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"3\"/><path d=\"M9 4v16m4-11h4m-4 5h4\"/></svg></button>\n      <button class=\"header-btn\" id=\"header-new-chat\" type=\"button\" title=\"New chat\" aria-label=\"New chat\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg></button>\n      <button class=\"header-btn\" id=\"theme-toggle\" type=\"button\" title=\"Switch theme\" aria-label=\"Switch theme\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5\"/></svg></button>\n      <button class=\"header-btn\" id=\"resize-chat\" type=\"button\" title=\"Expand chat\" aria-label=\"Expand chat\" aria-pressed=\"false\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 4h6v6M20 4l-7 7M10 20H4v-6m0 6 7-7\"/></svg></button>\n      <button class=\"header-btn\" id=\"close-chat\" type=\"button\" title=\"Close chat\" aria-label=\"Close chat\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m6 6 12 12M6 18 18 6\"/></svg></button>\n    </div>\n  </header>\n  <nav class=\"chat-toolbar\" aria-label=\"Conversation controls\">\n    <button class=\"toolbar-btn\" id=\"new-chat\" type=\"button\" title=\"Start a new chat\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 11.5a8 8 0 0 1-8 8H6l-4 3 1.7-6A8 8 0 0 1 3 13v-2a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z\"/></svg><span>New chat</span></button>\n    <button class=\"toolbar-btn\" id=\"clear-chat\" type=\"button\" title=\"Clear this conversation\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7\"/></svg><span>Clear chat</span></button>\n  </nav>\n  <div id=\"chat-messages\" role=\"log\" aria-label=\"Chat messages\" aria-live=\"polite\" aria-relevant=\"additions\"></div>\n  <footer class=\"chat-footer\">\n    <div class=\"input-wrapper\">\n      <textarea id=\"message-input\" rows=\"1\" placeholder=\"Ask about your store&hellip;\" aria-label=\"Message your store assistant\" aria-describedby=\"mcp-composer-help\"></textarea>\n    </div>\n    <button id=\"send-btn\" type=\"button\" title=\"Send message\" aria-label=\"Send message\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m4 4 17 8-17 8 4-8-4-8Z\"/><path d=\"M8 12h13\"/></svg></button>\n    <p class=\"composer-note\" id=\"mcp-composer-help\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.65\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v6m0-10v.1\"/></svg><span>Changes always ask for your confirmation.</span></p>\n  </footer>\n</section>\n<button id=\"mcp-toggle\" type=\"button\" aria-label=\"Open store assistant\" aria-expanded=\"false\" aria-controls=\"chat-widget\"><svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"currentColor\"><path d=\"M12 2c1.4 6.2 3.8 8.6 10 10-6.2 1.4-8.6 3.8-10 10C10.6 15.8 8.2 13.4 2 12c6.2-1.4 8.6-3.8 10-10Z\"/></svg></button>\n\r\n";
    document.body.appendChild(mount);
    return true;
  }

  function ensureRuntime() {
    return new Promise((resolve) => {
      const s = document.createElement("script");
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
