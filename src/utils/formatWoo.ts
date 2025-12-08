export function formatProducts(products: any[]): string {
  if (!Array.isArray(products) || products.length === 0) {
    return `<div class="products-empty">No products found.</div>`;
  }

  const style = `
<style>
/* layout */
.product-card,
.product-card * { box-sizing: border-box; }

.product-card{
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(102,126,234,0.25);
  border-radius:12px;
  padding:12px 14px;
  margin:12px 0;
  color:#e0e0ff;
}
.product-card h3{margin:0 0 8px 0;font-size:16px}
.product-card p{margin:4px 0 0 0;font-size:13px}

/* wrap long content everywhere (links, long words) */
.product-card a,
.product-card p,
.product-card dd,
.product-card dt,
.product-card li {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.product-card a{color:#a6b8ff;text-decoration:underline}

.product-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;border:1px solid rgba(255,255,255,0.25);padding:2px 6px;border-radius:8px;font-size:12px;opacity:.9}
.price{font-weight:700}
.sale{color:#ffd166;font-weight:700;margin-left:8px}
.tags, .cats, .brands{opacity:.9}

/* media strip */
.media-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.media-strip img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.2)}

/* details accordion */
.details{margin-top:10px}
.details summary{cursor:pointer;user-select:none;font-weight:700;font-size:14px;margin-bottom:6px}
.kv-table{display:grid;grid-template-columns:minmax(120px, 180px) 1fr;gap:6px 12px;margin:6px 0}
.details dt{opacity:.8}
.details dd{margin:0;white-space:pre-wrap}

/* lists */
.kv-list{margin:4px 0 0 0;padding-left:16px}
.kv-list li{margin:2px 0;font-size:13px}

/* tables */
.attr-table, .dl-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;table-layout:fixed}
.attr-table th, .attr-table td, .dl-table th, .dl-table td{border:1px solid rgba(255,255,255,0.2);padding:6px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}
.attr-table th, .dl-table th{background:rgba(255,255,255,0.06)}
.code{font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; word-break:break-all}

.hr{height:1px;background:rgba(255,255,255,0.15);margin:8px 0}
.products-empty{opacity:.8}
</style>`;

  const cards = products.map((p) => renderProduct(p)).join("");
  return style + cards;
}

function renderProduct(p: any): string {
  const name = safe(p?.name) || "—";
  const id = val(p?.id);
  const type = safe(p?.type) || "—";
  const status = safe(p?.status) || "—";
  const permalink = safe(p?.permalink);
  const permalinkIsDraftStyle =
    typeof permalink === "string" && permalink.includes("post_type=product");

  const price = choose(p?.price, p?.regular_price);
  const sale = val(p?.sale_price);
  const onSale = bool(p?.on_sale);

  const sku = safe(p?.sku) || "—";
  const stockQty = numOrDash(p?.stock_quantity);
  const stockStatus = safe(p?.stock_status) || "—";
  const manageStock = bool(p?.manage_stock);
  const backorders = safe(p?.backorders) || "—";
  const soldIndividually = bool(p?.sold_individually);
  const lowStockAmount = numOrDash(p?.low_stock_amount);

  const weight = safe(p?.weight) || "—";
  const dims = p?.dimensions || {};
  const length = safe(dims?.length) || "—";
  const width = safe(dims?.width) || "—";
  const height = safe(dims?.height) || "—";
  const shippingClass = safe(p?.shipping_class) || "—";
  const shippingClassId = val(p?.shipping_class_id);

  const taxStatus = safe(p?.tax_status) || "—";
  const taxClass = safe(p?.tax_class) || "—";

  const categories = listNames(p?.categories);
  const tags = listNames(p?.tags);
  const brands = detectBrands(p);

  const rating = safe(p?.average_rating) || "—";
  const ratingCount = numOrDash(p?.rating_count);
  const totalSales = numOrDash(p?.total_sales);
  const reviewsAllowed = bool(p?.reviews_allowed);

  const downloadAble = bool(p?.downloadable);
  const virtual = bool(p?.virtual);
  const externalUrl = safe(p?.external_url) || "—";
  const buttonText = safe(p?.button_text) || "—";

  const parentId = val(p?.parent_id);
  const menuOrder = val(p?.menu_order);

  const upsells = idList(p?.upsell_ids);
  const crossSells = idList(p?.cross_sell_ids);
  const grouped = idList(p?.grouped_products);
  const relatedIds = idList((p as any)?.related_ids);

  const dateCreated = dateOrDash(p?.date_created);
  const dateModified = dateOrDash(p?.date_modified);

  const shortDesc = stripHtml(p?.short_description);
  const desc = stripHtml(p?.description);

  const images = Array.isArray(p?.images) ? p.images : [];
  const imageStrip = images
    .slice(0, 8)
    .map((img: any) => `<img src="${safe(img?.src)}" alt="${safe(img?.alt || img?.name || "")}" />`)
    .join("");

  const attributes = Array.isArray(p?.attributes) ? p.attributes : [];
  const attrTable = attributes.length
    ? `
<table class="attr-table">
  <thead><tr><th>Name</th><th>Visible</th><th>Variation</th><th>Options</th></tr></thead>
  <tbody>
    ${attributes
      .map((a: any) => {
        const nm = safe(a?.name) || "—";
        const vis = bool(a?.visible);
        const vari = bool(a?.variation);
        const opts = Array.isArray(a?.options) && a.options.length
          ? a.options.map((o: any) => safe(o)).join(", ")
          : "—";
        return `<tr><td>${nm}</td><td>${vis}</td><td>${vari}</td><td>${opts}</td></tr>`;
      })
      .join("")}
  </tbody>
</table>`
    : "—";

  const defaultAttrs = Array.isArray(p?.default_attributes) ? p.default_attributes : [];
  const defaultAttrRows = defaultAttrs.length
    ? `
<table class="dl-table">
  <thead><tr><th>Attribute</th><th>Value</th></tr></thead>
  <tbody>
    ${defaultAttrs
      .map((d: any) => `<tr><td>${safe(d?.name) || "—"}</td><td>${safe(d?.option) || "—"}</td></tr>`)
      .join("")}
  </tbody>
</table>`
    : "—";

  const variations = Array.isArray(p?.variations) ? p.variations : [];
  const variationLine = variations.length ? `${variations.length} variations` : "—";

  const downloads = Array.isArray(p?.downloads) ? p.downloads : [];
  const downloadsTable = downloads.length
    ? `
<table class="dl-table">
  <thead><tr><th>Name</th><th>File</th></tr></thead>
  <tbody>
    ${downloads
      .map((d: any) => `<tr><td>${safe(d?.name) || "—"}</td><td class="code">${safe(d?.file) || "—"}</td></tr>`)
      .join("")}
  </tbody>
</table>`
    : "—";

  const meta = Array.isArray(p?.meta_data) ? p.meta_data : [];
  const metaRows = meta.length
    ? `
<table class="dl-table">
  <thead><tr><th>Key</th><th>Value</th></tr></thead>
  <tbody>
    ${meta
      .map((m: any) => `<tr><td class="code">${safe(m?.key) || "—"}</td><td>${safe(stringifyMaybe(m?.value))}</td></tr>`)
      .join("")}
  </tbody>
</table>`
    : "—";

  const head = `
<div class="product-head">
  <h3>${name}</h3>
  <span class="badge">ID ${id}</span>
  <span class="badge">${type}</span>
  <span class="badge">${status}</span>
</div>
<p class="price">Price: ${money(price)}${sale ? ` <span class="sale">Sale: ${money(sale)}</span>` : ""}${onSale === "Yes" ? " • On sale" : ""}</p>

<ul class="kv-list">
  <li>SKU: ${sku}</li>
  <li>Stock: ${stockQty} (${stockStatus})</li>
  <li>Manage stock: ${manageStock}</li>
  <li>Backorders: ${backorders}</li>
  <li>Sold individually: ${soldIndividually}</li>
</ul>

<p class="cats">Categories: ${categories}</p>
<p class="tags">Tags: ${tags}</p>
<p class="brands">Brands: ${brands}</p>
${imageStrip ? `<div class="media-strip">${imageStrip}</div>` : ""}`;

  const body = `
<details class="details"><summary>Full details</summary>

<div class="hr"></div>
<dl class="kv-table">
  <dt>Permalink</dt>
  <dd>${permalink ? `<a href="${permalink}" target="_blank">${permalink}</a>` : "—"}</dd>

  ${
    permalinkIsDraftStyle
      ? `<dt>Permalink note</dt><dd>Product post link because product is still in draft.</dd>`
      : ""
  }

  <dt>Average rating</dt><dd>${rating}</dd>
  <dt>Rating count</dt><dd>${ratingCount}</dd>
  <dt>Total sales</dt><dd>${totalSales}</dd>
  <dt>Reviews allowed</dt><dd>${reviewsAllowed}</dd>
</dl>


<div class="hr"></div>
<h4>Tax and shipping</h4>
<dl class="kv-table">
  <dt>Tax status</dt><dd>${taxStatus}</dd>
  <dt>Tax class</dt><dd>${taxClass}</dd>
  <dt>Weight</dt><dd>${weight}</dd>
  <dt>Dimensions</dt><dd>L ${length} × W ${width} × H ${height}</dd>
  <dt>Shipping class</dt><dd>${shippingClass}</dd>
  <dt>Shipping class ID</dt><dd>${shippingClassId}</dd>
</dl>

<div class="hr"></div>
<h4>Type specifics</h4>
<dl class="kv-table">
  <dt>Downloadable</dt><dd>${downloadAble}</dd>
  <dt>Virtual</dt><dd>${virtual}</dd>
  <dt>External URL</dt><dd>${externalUrl}</dd>
  <dt>Button text</dt><dd>${buttonText}</dd>
  <dt>Parent ID</dt><dd>${parentId}</dd>
  <dt>Menu order</dt><dd>${menuOrder}</dd>
  <dt>Low stock amount</dt><dd>${lowStockAmount}</dd>
</dl>

<div class="hr"></div>
<h4>Attributes</h4>
${attrTable}

<div class="hr"></div>
<h4>Default attributes</h4>
${defaultAttrRows}

<div class="hr"></div>
<h4>Variations</h4>
<p>${variationLine}</p>

<div class="hr"></div>
<h4>Linked products</h4>
<dl class="kv-table">
  <dt>Upsells</dt><dd>${upsells}</dd>
  <dt>Cross-sells</dt><dd>${crossSells}</dd>
  <dt>Grouped</dt><dd>${grouped}</dd>
  <dt>Related</dt><dd>${relatedIds}</dd>
</dl>

<div class="hr"></div>
<h4>Content</h4>
<dl class="kv-table">
  <dt>Short description</dt><dd>${shortDesc || "—"}</dd>
  <dt>Description</dt><dd>${desc || "—"}</dd>
</dl>

<div class="hr"></div>
<h4>Downloads</h4>
${downloadsTable}

<div class="hr"></div>
<h4>Meta data</h4>
${metaRows}

<div class="hr"></div>
<h4>Dates</h4>
<dl class="kv-table">
  <dt>Created</dt><dd>${dateCreated}</dd>
  <dt>Modified</dt><dd>${dateModified}</dd>
</dl>

</details>`;

  return `
<article class="product-card">
  ${head}
  ${body}
</article>`;
}

/* helpers */
function safe(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function val(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
function money(v: any): string {
  if (v === null || v === undefined || v === "" || v === "0") return "—";
  return `₪${v}`;
}
function bool(v: any): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}
function numOrDash(v: any): string {
  if (v === 0) return "0";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}
function listNames(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((x) => safe(x?.name ?? x)).join(", ");
}
function idList(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "—";
  return arr.map((x) => safe(x)).join(", ");
}
function stringifyMaybe(v: any): string {
  try {
    if (typeof v === "string") return v;
    return JSON.stringify(v);
  } catch {
    return String(v ?? "");
  }
}
function stripHtml(html: any): string {
  const s = typeof html === "string" ? html : "";
  return s.replace(/<[^>]*>/g, "").trim();
}
function dateOrDash(d: any): string {
  if (!d) return "—";
  const s = typeof d === "string" ? d : d?.date || d?.rendered || "";
  return s || "—";
}
function choose<T>(...vals: T[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/* brand detection */
function detectBrands(p: any): string {
  if (Array.isArray(p?.brands) && p.brands.length) {
    return p.brands.map((b: any) => safe(b?.name ?? b)).join(", ");
  }
  if (Array.isArray(p?.attributes) && p.attributes.length) {
    for (const a of p.attributes) {
      const nm = (a?.name || "").toString().toLowerCase();
      if (nm === "brand" || nm === "brands" || nm === "yith_product_brand") {
        if (Array.isArray(a?.options) && a.options.length) {
          return a.options.map((o: any) => safe(o)).join(", ");
        }
      }
    }
  }
  if (Array.isArray(p?.meta_data) && p.meta_data.length) {
    const wanted = ["brand", "brands", "yith_product_brand", "_yith_wcbr_brands"];
    const found: string[] = [];
    for (const m of p.meta_data) {
      const key = (m?.key || "").toString().toLowerCase();
      if (wanted.includes(key)) {
        const v = m?.value;
        if (Array.isArray(v)) {
          found.push(...v.map((x: any) => safe(x?.name ?? x)));
        } else if (v && typeof v === "object" && v.name) {
          found.push(safe(v.name));
        } else if (typeof v === "string") {
          found.push(safe(v));
        }
      }
    }
    if (found.length) return Array.from(new Set(found)).join(", ");
  }
  return "—";
}

/* -------------------------------------------
   SINGLE PRODUCT FORMATTER
------------------------------------------- */

export function formatSingleProduct(product: any): string {
  // reuse the same style as list view
  const style = `
<style>
/* layout */
.product-card,
.product-card * { box-sizing: border-box; }

.product-card{
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(102,126,234,0.25);
  border-radius:12px;
  padding:12px 14px;
  margin:12px 0;
  color:#e0e0ff;
}
.product-card h3{margin:0 0 8px 0;font-size:16px}
.product-card p{margin:4px 0 0 0;font-size:13px}

/* wrap long content everywhere (links, long words) */
.product-card a,
.product-card p,
.product-card dd,
.product-card dt,
.product-card li {
  word-break: break-word;
  overflow-wrap: anywhere;
}
.product-card a{color:#a6b8ff;text-decoration:underline}

.product-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;border:1px solid rgba(255,255,255,0.25);padding:2px 6px;border-radius:8px;font-size:12px;opacity:.9}
.price{font-weight:700}
.sale{color:#ffd166;font-weight:700;margin-left:8px}
.tags, .cats, .brands{opacity:.9}

/* media strip */
.media-strip{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.media-strip img{width:44px;height:44px;object-fit:cover;border-radius:6px;border:1px solid rgba(255,255,255,0.2)}

/* details accordion */
.details{margin-top:10px}
.details summary{cursor:pointer;user-select:none;font-weight:700;font-size:14px;margin-bottom:6px}
.kv-table{display:grid;grid-template-columns:minmax(120px, 180px) 1fr;gap:6px 12px;margin:6px 0}
.details dt{opacity:.8}
.details dd{margin:0;white-space:pre-wrap}

/* lists */
.kv-list{margin:4px 0 0 0;padding-left:16px}
.kv-list li{margin:2px 0;font-size:13px}

/* tables */
.attr-table, .dl-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:13px;table-layout:fixed}
.attr-table th, .attr-table td, .dl-table th, .dl-table td{border:1px solid rgba(255,255,255,0.2);padding:6px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}
.attr-table th, .dl-table th{background:rgba(255,255,255,0.06)}
.code{font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; word-break:break-all}

.hr{height:1px;background:rgba(255,255,255,0.15);margin:8px 0}
.products-empty{opacity:.8}
</style>`;

  // render the same card and force the details block to be open for single view
  let card = renderProduct(product);
  card = card.replace('<details class="details">', '<details class="details" open>');

  return style + card;
}

/* -------------------------------------------
   FORMAT PRODUCT BY SKU (REUSE SINGLE FORMATTER)
------------------------------------------- */

export function formatProductBySku(product: any): string {
  return formatSingleProduct(product);
}




//more formats