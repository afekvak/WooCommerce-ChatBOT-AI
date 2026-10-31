# Product management coverage

The assistant uses shared resource schemas and backend operations. It does not need a new AI tool for each editable field, and it does not learn new API permissions on its own.

## Tool flow

1. `describe_catalog_resource` returns the writable schema and available filter vocabulary.
2. `read_catalog` resolves actual IDs and reads current data. List results include `next_page`; a page is not necessarily the whole catalog.
3. `prepare_catalog_change` validates one create/update/delete and stores a server-owned confirmation preview.
4. `prepare_catalog_batch` validates 1–100 explicit operations for the same resource and parent.
5. Only a subsequent confirm executes the stored payload. Cancel discards it. Side questions cannot execute or replace the pending change.

Ordinary product updates still use `prepare_product_update`, now backed by `src/services/productSchema.ts`. Percentage price adjustments are calculated from a fresh product read. The existing guided create and bulk percentage workflows remain available.

## Coverage

| Resource | Read/list | Create/update/delete | Batch | Notes |
| --- | --- | --- | --- | --- |
| Products | Yes | Yes | Yes | Simple, variable, grouped and external product fields; default creates are drafts |
| Variations | Yes | Yes | Yes | Requires parent product ID; new variations require a variable parent and enabled attributes |
| Categories | Yes | Yes | Yes | Includes parent category, image and display settings |
| Tags | Yes | Yes | Yes | Assign product terms using real IDs |
| Global attributes | Yes | Yes | Yes | Their unpaginated WooCommerce list is filtered/paginated locally |
| Attribute terms | Yes | Yes | Yes | Requires parent attribute ID |
| Shipping classes | Yes | Yes | Yes | Product assignment uses the shipping-class slug |
| Brands | Yes | Yes | No | Requires a compatible installed brands endpoint |
| Reviews | Yes | Yes | Yes | Only authentic user-supplied review content; supports moderation |

Product changes cover identity, descriptions, prices and sale scheduling, status and visibility, inventory/backorders, images, dimensions, shipping and tax properties, downloads, categories/tags/brands, attributes and variation defaults, grouped/related products, ordering, and supported customs identifiers. Explicit metadata JSON is supported through the generic catalog workflow; unknown top-level extension fields are rejected.

`CatalogService` owns the allowlisted paths and transport. Resource schemas reject read-only fields and credential overrides. Requests cannot choose arbitrary API URLs. Credentials always come from the authenticated store context.

## Images

For normal product-image requests the model uses `prepare_product_update.imageChange`:

- `replace_featured`: replace the first image while preserving the rest of the gallery.
- `append`: add images after the existing gallery.
- `remove`: remove selected existing images by ID or exact URL.
- `replace_gallery`: replace the entire gallery explicitly.
- `clear`: remove all product images explicitly.

Images can refer to an existing media ID or a new HTTP(S) URL. Image names and alt text are supported. A plain URL entered in the guided images question replaces the main image while preserving the remaining gallery. JSON arrays deliberately replace the whole gallery.

WooCommerce downloads remote images only after confirmation. The URL must serve an image that the store can fetch; image permissions, hotlink protection, unsupported file types and server networking can still prevent an import. Upstream errors are reported. The backend does not pretend that checking URL syntax proves an image can be imported.

Image updates re-read the current gallery before writing. If it changed since the preview, the assistant requests a fresh preview rather than overwriting newly added gallery images.

Example requests:

- Change the main image of Blue Shirt to https://example.com/new-shirt.jpg and keep its other images.
- Add these two URLs to the gallery of product 42.
- Set the weight of product 42 to 0.5 and its dimensions to 20 by 15 by 3.
- Create a product category called Summer Essentials.
- Show the variations of product 42.
- Create a draft blue, medium variation under variable product 42 using its existing attributes.
- Change the sale price of variations 7 and 8 under product 42 to 25.
- Move product 42 to trash.

## Deletion and batches

Individual product deletion defaults to trash. Restore with a confirmed status update. Product permanent deletion requires an explicit permanent flag and a confirmation preview.

WooCommerce variations, taxonomy resources and reviews do not support trash through these delete endpoints: their deletion preview explicitly says permanent. Batch deletions require the permanent flag and are always described as permanent. No batch may update and delete the same ID, repeat an ID, or exceed 100 total operations.

Batches are not transactions. The assistant counts successful item results, reports individual failures, and never automatically retries a partially successful batch. Bigger jobs must be split into explicit batches with separate previews.

## Scope and remaining constraints

- This covers the advertised WooCommerce core product resources, not orders, customers, coupons or store-wide shipping-zone management.
- Installed WooCommerce/plugin versions and API-key permissions remain authoritative. A supported schema is not proof that a particular store exposes a newer feature such as brands, variation galleries or customs fields.
- Plugin-specific operations, subscriptions, bundles, custom product types, SEO fields and arbitrary extension routes need their own verified capability/schema. Metadata JSON does not guarantee a plugin understands an invented key.
- Native optional arguments use null to represent omitted values. To explicitly clear nullable fields such as sale dates, use the catalog workflow's `data_json`, which preserves null exactly.
- The model gets a bounded number of reads per turn. Large catalogs require pagination and sometimes follow-up turns; it must not claim a truncated result is complete.
- Pending confirmations live in this Node process, expire after 15 minutes for generic catalog changes, and are lost on backend restart. Multi-instance deployment needs shared pending-operation storage.
- Network timeouts can leave the result of a write uncertain. Check fresh data before preparing another write; a failure message is not a rollback.
- Live-model interpretation was tested against a mock WooCommerce store. No real product writes were executed during implementation.

## Verification

Run `node node_modules/typescript/bin/tsc --noEmit` and `node --import tsx --test tests/catalog.test.ts tests/toolCalling.test.ts tests/chatImprovements.test.ts tests/productService.test.ts tests/toolRegistry.test.ts tests/memory.test.ts tests/conversations.test.ts`.

The catalog tests exercise all nine resources, strict validation, parent paths, no writes before confirmation, cancellation, repeat confirmation, image preservation and stale previews, filtered reads, batch limits and partial failures.

References: [WooCommerce products](https://developer.woocommerce.com/docs/apis/rest-api/v3/products/), [variations](https://developer.woocommerce.com/docs/apis/rest-api/v3/product-variations/), [attributes](https://developer.woocommerce.com/docs/apis/rest-api/v3/product-attributes/), [categories](https://developer.woocommerce.com/docs/apis/rest-api/v3/product-categories/).

Missing-name product requests retain server-side state: ?Add a product? asks for a name and then continues the guided basic/advanced questions. Already supplied basic fields are skipped and preserved. A complete creation request still goes directly to a draft preview. Cancel or chat deletion/clearing discards that pending request; it expires after 15 minutes or backend restart. Explicit guided mode remains available.

Product presentation: legacy product reads and structured `read_catalog` product/variation results use the shared compact card formatter. Catalog tool data stays structured for model reasoning; server-rendered presentation is separate. Lists show pagination information. Confirmed create/update and successful batch product/variation results also render cards; deletions return a status message rather than a current-product card.
