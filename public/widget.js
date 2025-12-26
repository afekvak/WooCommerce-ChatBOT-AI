// public/widget.js
// Loads widget.css + widget.html then loads widget.runtime.js
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

  window.__MCP_WIDGET_CONFIG__ = {
    MCP_URL,
    TITLE,
    CLIENT_KEY,
    ASSET_BASE: base,
  };

  function loadCss() {
    return new Promise((resolve) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${base}/widget.css${qs}`;
      link.onload = () => resolve(true);
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
  }

  async function loadHtml() {
    try {
      const res = await fetch(`${base}/widget.html${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("widget.html not found");
      const html = await res.text();

      const mount = document.createElement("div");
      mount.id = "mcp-widget-mount";
      mount.innerHTML = html;
      document.body.appendChild(mount);

      const titleNode = document.getElementById("mcp-title");
      if (titleNode) titleNode.textContent = TITLE;

      return true;
    } catch (e) {
      console.error("Failed to load widget.html", e);
      return false;
    }
  }

  function loadRuntime() {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = `${base}/widget.runtime.js${qs}`;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }

  async function boot() {
    await loadCss();
    const okHtml = await loadHtml();
    if (!okHtml) return;

    const okRuntime = await loadRuntime();
    if (!okRuntime) console.error("Failed to load widget.runtime.js");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
