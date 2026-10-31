import { z } from "zod";
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const url = z.string().url().regex(/^https?:\/\//i, "Use a public HTTP or HTTPS URL");
const price = z.string().regex(/^(\d+(\.\d+)?)?$/);
const measurement = z.string().regex(/^(\d+(\.\d+)?)?$/);
export const productImageSchema = z.object({
    id: id.optional(), src: url.optional(), name: z.string().optional(), alt: z.string().optional()
}).strict();
const term = z.object({ id }).strict();
const attribute = z.object({
    id: z.number().int().nonnegative().optional(), name: z.string().min(1).optional(), position: z.number().int().nonnegative().optional(), visible: z.boolean().optional(), variation: z.boolean().optional(), options: z.array(z.string()).optional()
}).strict();
/** Writable core product fields. Read-only fields and extension payloads are deliberately excluded. */
export const productChangesSchema = z.object({
    global_unique_id: z.string().optional(),
    customs_commodity_code: z.string().regex(/^[0-9 .-]*$/).nullable().optional(),
    customs_country_of_origin: z.string().regex(/^[A-Za-z]{2}$/).nullable().optional(),
    customs_description: z.string().max(35).nullable().optional(),
    name: z.string().min(1).optional(), slug: z.string().optional(),
    type: z.enum(["simple", "grouped", "external", "variable"]).optional(),
    status: z.enum(["draft", "publish", "pending", "private"]).optional(),
    featured: z.boolean().optional(), catalog_visibility: z.enum(["visible", "catalog", "search", "hidden"]).optional(),
    description: z.string().optional(), short_description: z.string().optional(), sku: z.string().optional(),
    regular_price: price.optional(), sale_price: price.optional(),
    date_on_sale_from: z.string().datetime({ local: true, offset: true }).nullable().optional(), date_on_sale_to: z.string().datetime({ local: true, offset: true }).nullable().optional(),
    date_on_sale_from_gmt: z.string().datetime({ local: true, offset: true }).nullable().optional(),
    date_on_sale_to_gmt: z.string().datetime({ local: true, offset: true }).nullable().optional(),
    virtual: z.boolean().optional(), downloadable: z.boolean().optional(),
    downloads: z.array(z.object({ id: z.string().optional(), name: z.string().optional(), file: url }).strict()).optional(),
    download_limit: z.number().int().min(-1).optional(), download_expiry: z.number().int().min(-1).optional(),
    external_url: z.union([url, z.literal("")]).optional(), button_text: z.string().optional(),
    tax_status: z.enum(["taxable", "shipping", "none"]).optional(), tax_class: z.string().optional(),
    manage_stock: z.boolean().optional(), stock_quantity: z.number().int().safe().optional(),
    stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(),
    backorders: z.enum(["no", "notify", "yes"]).optional(), sold_individually: z.boolean().optional(),
    weight: measurement.optional(), dimensions: z.object({ length: measurement.optional(), width: measurement.optional(), height: measurement.optional() }).strict().optional(),
    shipping_class: z.string().optional(), reviews_allowed: z.boolean().optional(),
    upsell_ids: z.array(id).optional(), cross_sell_ids: z.array(id).optional(), parent_id: z.number().int().nonnegative().optional(),
    purchase_note: z.string().optional(), categories: z.array(term).optional(), tags: z.array(term).optional(), brands: z.array(term).optional(),
    images: z.array(productImageSchema).max(100).describe("Complete replacement gallery; empty removes all images. Use imageChange for a main-image replacement or append that preserves other images.").optional(),
    attributes: z.array(attribute).optional(),
    default_attributes: z.array(z.object({
        id: z.number().int().nonnegative().optional(), name: z.string().min(1).optional(), option: z.string()
    }).strict()).optional(),
    grouped_products: z.array(id).optional(), menu_order: z.number().int().optional()
}).strict();
export const imageChangeSchema = z.object({
    mode: z.enum(["replace_featured", "append", "replace_gallery", "remove", "clear"]),
    images: z.array(productImageSchema).max(100).describe("Exactly one image for replace_featured; at least one for append; empty for clear.")
}).strict();
export type ImageChange = z.infer<typeof imageChangeSchema>;
export function validateProductChanges(changes: Record<string, unknown>) {
    const parsed = productChangesSchema.parse(changes);
    for (const image of parsed.images || []) {
        if (image.id && image.src)
            throw new Error("Use either an existing media ID or a new image URL, not both for one image.");
        if (!image.id && !image.src)
            throw new Error("Each image requires an existing media ID or a public image URL.");
    }
    for (const attr of [...(parsed.attributes || []), ...(parsed.default_attributes || [])]) {
        if (!attr.id && !attr.name)
            throw new Error("Each attribute needs an ID or name.");
    }
    return parsed;
}
export function applyImageChange(original: {
    images?: unknown[];
}, change: ImageChange) {
    const { mode, images } = imageChangeSchema.parse(change);
    validateProductChanges({ images });
    if (mode === "clear") {
        if (images.length)
            throw new Error("Clear images requires an empty image list.");
        return [];
    }
    if (mode === "replace_featured" && images.length !== 1)
        throw new Error("Main image replacement requires exactly one image.");
    if (mode === "append" && !images.length)
        throw new Error("Choose at least one image to append.");
    const existing = (original.images || []).map((entry: any) => {
        if (entry.id)
            return { id: entry.id };
        if (entry.src)
            return { src: entry.src };
        throw new Error("An existing gallery image could not be preserved. Please refresh the product.");
    });
    if (mode === "replace_gallery")
        return images;
    if (mode === "remove") {
        if (!images.length)
            throw new Error("Choose at least one existing image to remove.");
        const originals = original.images as Array<{
            id?: number;
            src?: string;
        }> || [];
        const matches = (entry: {
            id?: number;
            src?: string;
        }, wanted: {
            id?: number;
            src?: string;
        }) => wanted.id ? entry.id === wanted.id : entry.src === wanted.src;
        if (images.some(wanted => !originals.some(entry => matches(entry, wanted))))
            throw new Error("An image to remove is not in this product gallery.");
        return existing.filter((_, index) => !images.some(wanted => matches(originals[index], wanted)));
    }
    return mode === "append" ? [...existing, ...images] : [...images, ...existing.slice(1)];
}
