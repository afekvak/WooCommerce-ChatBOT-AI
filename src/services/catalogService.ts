import { z } from "zod";
import { createWooClient } from "../controllers/wooClient";
import { productChangesSchema, productImageSchema, validateProductChanges } from "./productSchema";
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const metadata = z.array(z.object({ key: z.string().min(1), value: z.unknown() }).strict());
const product = productChangesSchema.extend({ meta_data: metadata.optional() });
const term = z.object({ name: z.string().min(1).optional(), slug: z.string().optional(), description: z.string().optional() }).strict();
const variation = product.pick({
    global_unique_id: true, customs_commodity_code: true, customs_country_of_origin: true, customs_description: true, description: true, sku: true, regular_price: true, sale_price: true, date_on_sale_from: true, date_on_sale_to: true, date_on_sale_from_gmt: true, date_on_sale_to_gmt: true, status: true, virtual: true, downloadable: true, downloads: true, download_limit: true, download_expiry: true, tax_status: true, tax_class: true, stock_quantity: true, stock_status: true, backorders: true, weight: true, dimensions: true, shipping_class: true, menu_order: true, meta_data: true
}).extend({
    manage_stock: z.union([z.boolean(), z.literal("parent")]).optional(),
    image: productImageSchema.extend({ id: z.number().int().nonnegative().optional() }).optional(),
    gallery_image_ids: z.array(id).optional(),
    attributes: z.array(z.object({ id: z.number().int().nonnegative().optional(), name: z.string().optional(), option: z.string() }).strict()).optional()
}).strict();
export const catalogResources = [
    "product", "variation", "category", "tag", "attribute", "attribute_term", "shipping_class", "brand", "review"
] as const;
export const catalogResourceSchema = z.enum(catalogResources);
export type CatalogResource = z.infer<typeof catalogResourceSchema>;
export const catalogSchemas = {
    product,
    variation,
    category: term.extend({
        parent: z.number().int().nonnegative().optional(), display: z.enum(["default", "products", "subcategories", "both"]).optional(), image: productImageSchema.optional(), menu_order: z.number().int().optional()
    }),
    tag: term,
    attribute: z.object({
        name: z.string().min(1).optional(), slug: z.string().optional(), type: z.literal("select").optional(), order_by: z.enum(["menu_order", "name", "name_num", "id"]).optional(), has_archives: z.boolean().optional()
    }).strict(),
    attribute_term: term.extend({ menu_order: z.number().int().optional() }),
    shipping_class: term,
    brand: term.extend({ image: productImageSchema.optional() }),
    review: z.object({
        product_id: id.optional(), review: z.string().optional(), reviewer: z.string().optional(), reviewer_email: z.string().email().optional(), rating: z.number().int().min(0).max(5).optional(), status: z.enum(["approved", "hold", "spam", "unspam", "trash", "untrash"]).optional()
    }).strict()
} satisfies Record<CatalogResource, z.AnyZodObject>;
export const catalogFilterSchema = z.object({
    page: z.number().int().positive().optional(), per_page: z.number().int().min(1).max(100).optional(), search: z.string().optional(),
    include: z.array(id).optional(), exclude: z.array(id).optional(), orderby: z.enum([
        "date", "id", "include", "title", "slug", "price", "popularity", "rating", "name", "menu_order", "count", "term_group"
    ]).optional(), order: z.enum(["asc", "desc"]).optional(),
    status: z.enum(["any", "draft", "pending", "private", "publish", "trash", "approved", "hold", "spam", "all"]).optional(),
    sku: z.string().optional(), slug: z.string().optional(), category: id.optional(), tag: id.optional(), type: z.enum(["simple", "grouped", "external", "variable"]).optional(),
    stock_status: z.enum(["instock", "outofstock", "onbackorder"]).optional(), on_sale: z.boolean().optional(), featured: z.boolean().optional(), min_price: z.string().regex(/^\d+(\.\d+)?$/).optional(), max_price: z.string().regex(/^\d+(\.\d+)?$/).optional(),
    attribute: z.string().optional(), attribute_term: id.optional(), product: z.array(id).optional(), parent: z.number().int().nonnegative().optional(), hide_empty: z.boolean().optional(), after: z.string().datetime({ offset: true, local: true }).optional(), before: z.string().datetime({ offset: true, local: true }).optional()
}).strict();
export interface CatalogTarget {
    resource: CatalogResource;
    parentId?: number;
    id?: number;
}
export function catalogPath(target: CatalogTarget) {
    const { resource, parentId } = target;
    catalogResourceSchema.parse(resource);
    if (target.id !== undefined)
        id.parse(target.id);
    if (parentId !== undefined)
        id.parse(parentId);
    let path: string;
    if (resource === 'variation') {
        if (!parentId)
            throw Error('A parent product ID is required for variations.');
        path = 'products/' + parentId + '/variations';
    }
    else if (resource === 'attribute_term') {
        if (!parentId)
            throw Error('A parent attribute ID is required for terms.');
        path = 'products/attributes/' + parentId + '/terms';
    }
    else {
        if (parentId !== undefined)
            throw Error('parentId is only for variations and attribute terms.');
        path = {
            product: 'products', category: 'products/categories', tag: 'products/tags', attribute: 'products/attributes', shipping_class: 'products/shipping_classes', brand: 'products/brands', review: 'products/reviews'
        }[resource];
    }
    return target.id ? path + '/' + target.id : path;
}
export function catalogPayload(resource: CatalogResource, operation: 'create' | 'update', input: unknown) {
    const payload = catalogSchemas[resource].parse(input) as Record<string, any>;
    if (!Object.keys(payload).length)
        throw Error('Provide at least one writable field.');
    if (operation === 'create' && !['variation', 'review'].includes(resource) && !payload.name)
        throw Error('A name is required.');
    if (resource === 'review' && operation === 'create' && (!payload.product_id || !payload.review || !payload.reviewer || !payload.reviewer_email))
        throw Error('A review needs product_id, review, reviewer and reviewer_email. Never invent customer reviews.');
    for (const entry of payload.meta_data || [])
        if (!Object.prototype.hasOwnProperty.call(entry, 'value'))
            throw Error('Each metadata entry requires a value.');
    if (resource === 'product') {
        const { meta_data, ...core } = payload;
        validateProductChanges(core);
    }
    for (const image of [payload.image, ...(payload.images || [])].filter(Boolean)) {
        if (image.id === undefined && !image.src)
            throw Error('Each image requires a media ID or public image URL.');
    }
    for (const attr of payload.attributes || [])
        if (!attr.id && !attr.name)
            throw Error('Each attribute needs an ID or name.');
    return payload;
}
export function catalogBatchPayload(resource: CatalogResource, input: unknown, permanent = false) {
    if (resource === 'brand')
        throw Error('Brand batch operations are not advertised; use individual changes.');
    const batch = z.object({
        create: z.array(z.record(z.unknown())).optional(), update: z.array(z.record(z.unknown())).optional(), delete: z.array(id).optional()
    }).strict().parse(input);
    const count = (batch.create?.length || 0) + (batch.update?.length || 0) + (batch.delete?.length || 0);
    if (!count || count > 100)
        throw Error('A batch must contain 1 to 100 total operations.');
    if (batch.delete?.length && !permanent)
        throw Error('Batch deletion is permanent. Explicitly request permanent deletion or use individual product trash operations.');
    const touched = new Set<number>();
    const create = (batch.create || []).map(item => { const data = catalogPayload(resource, 'create', item); if (['product', 'variation'].includes(resource) && data.status === undefined)
        data.status = 'draft'; return data; });
    const update = (batch.update || []).map(item => { const itemId = id.parse(item.id); if (touched.has(itemId))
        throw Error('Duplicate resource IDs in a batch.'); touched.add(itemId); const { id: ignored, ...data } = item; return { id: itemId, ...catalogPayload(resource, 'update', data) }; });
    for (const itemId of batch.delete || []) {
        if (touched.has(itemId))
            throw Error('A resource cannot be updated and deleted in the same batch.');
        touched.add(itemId);
    }
    return { create, update, delete: batch.delete || [] };
}
export function validateVariationParent(parent: any, attributes: any[] = []) {
    if (parent.type !== 'variable')
        throw Error('Create variations only under a variable parent product.');
    for (const attr of attributes) {
        const match = (parent.attributes || []).find((entry: any) => attr.id ? entry.id === attr.id : String(entry.name).toLowerCase() === String(attr.name).toLowerCase());
        if (!match || !match.variation)
            throw Error('Variation attributes must first be enabled on the parent product.');
    }
}
export interface CatalogApi {
    get(path: string, params?: Record<string, unknown>): Promise<{
        data: any;
        headers?: Record<string, unknown>;
    }>;
    post(path: string, data: unknown): Promise<{
        data: any;
    }>;
    put(path: string, data: unknown): Promise<{
        data: any;
    }>;
    delete(path: string, params?: Record<string, unknown>): Promise<{
        data: any;
    }>;
}
/** Allowlisted resource paths and strict payloads, never model-supplied URLs or credentials. */
export class CatalogService {
    constructor(private readonly api: CatalogApi) { }
    async read(target: CatalogTarget, filters: unknown = {}) {
        const path = catalogPath(target);
        const parsed = catalogFilterSchema.parse(filters);
        if (target.id)
            return (await this.api.get(path, { context: 'edit' })).data;
        const page = parsed.page || 1, per_page = parsed.per_page || 20;
        const params: Record<string, unknown> = { ...parsed, page, per_page, context: 'edit' };
        for (const key of ['include', 'exclude', 'product'])
            if (Array.isArray(params[key]))
                params[key] = (params[key] as number[]).join(',');
        // Global attributes are returned as one unpaginated collection by WooCommerce.
        if (target.resource === 'attribute') {
            const allowed = new Set(['page', 'per_page', 'search', 'include', 'exclude', 'order', 'orderby']);
            for (const key of Object.keys(parsed))
                if (!allowed.has(key))
                    throw Error('Unsupported attribute filter: ' + key);
            let items = (await this.api.get(path, { context: 'edit' })).data as any[];
            if (parsed.search)
                items = items.filter(item => String(item.name).toLowerCase().includes(parsed.search!.toLowerCase()));
            if (parsed.include)
                items = items.filter(item => parsed.include!.includes(item.id));
            if (parsed.exclude)
                items = items.filter(item => !parsed.exclude!.includes(item.id));
            if (parsed.orderby && !['name', 'id', 'slug'].includes(parsed.orderby))
                throw Error('Attributes can be ordered by name, id or slug.');
            if (parsed.orderby) {
                const key = parsed.orderby;
                items = [...items].sort((a, b) => String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true }) * (parsed.order === 'desc' ? -1 : 1));
            }
            return {
                items: items.slice((page - 1) * per_page, page * per_page), page, per_page, next_page: page * per_page < items.length ? page + 1 : null
            };
        }
        const taxonomy = ['category', 'tag', 'attribute_term', 'shipping_class', 'brand'].includes(target.resource);
        const allowed = new Set(taxonomy ? [
            'page', 'per_page', 'search', 'include', 'exclude', 'orderby', 'order', 'slug', ...(target.resource === 'category' ? ['parent', 'hide_empty'] : ['hide_empty'])
        ] : target.resource === 'review' ? [
            'page', 'per_page', 'search', 'include', 'exclude', 'orderby', 'order', 'status', 'product', 'after', 'before'
        ] : [
            'page', 'per_page', 'search', 'include', 'exclude', 'orderby', 'order', 'status', 'sku', 'slug', ...(target.resource === 'product' ? ['category', 'tag', 'type', 'featured', 'attribute', 'attribute_term'] : []), 'stock_status', 'on_sale', 'min_price', 'max_price', 'parent', 'after', 'before'
        ]);
        for (const key of Object.keys(parsed))
            if (!allowed.has(key))
                throw Error('Unsupported ' + target.resource + ' filter: ' + key);
        const response = await this.api.get(path, params);
        const totalPages = Number(response.headers?.['x-wp-totalpages']);
        return {
            items: response.data, page, per_page, next_page: Number.isFinite(totalPages) ? page < totalPages ? page + 1 : null : Array.isArray(response.data) && response.data.length === per_page ? page + 1 : null
        };
    }
    async batch(target: CatalogTarget, input: unknown, permanent = false) {
        if (target.id)
            throw Error('A batch targets a collection, not an item ID.');
        const data = catalogBatchPayload(target.resource, input, permanent);
        return (await this.api.post(catalogPath(target) + '/batch', data)).data;
    }
    async write(target: CatalogTarget, operation: 'create' | 'update' | 'delete', data: unknown, permanent = false) {
        const path = catalogPath(target);
        if (operation === 'create') {
            if (target.id)
                throw Error('Create must not specify an existing ID.');
            return (await this.api.post(path, catalogPayload(target.resource, 'create', data))).data;
        }
        if (!target.id)
            throw Error('An existing resource ID is required.');
        if (operation === 'update')
            return (await this.api.put(path, catalogPayload(target.resource, 'update', data))).data;
        const hasTrash = ['product'].includes(target.resource);
        return (await this.api.delete(path, { force: permanent || !hasTrash })).data;
    }
}
export const createCatalogService = (url: string, ck: string, cs: string) => new CatalogService(createWooClient(url, ck, cs));
