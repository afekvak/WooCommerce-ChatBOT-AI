import {formatCatalogProducts} from "../../utils/formatWoo";
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { registerChatTool } from './registry';
import { catalogResourceSchema, catalogSchemas, catalogFilterSchema, createCatalogService, type CatalogTarget } from '../../services/catalogService';
import type { ToolCtx } from '../types';
import { resolveWooCredentials } from './woo/wooCredentials';
import { prepareCatalogChange, prepareCatalogBatch } from '../llm/wizards/catalogWizard';
import { describeInputSchema } from '../llm/toolCalling';
const selection = {
    resource: catalogResourceSchema, parentId: z.number().int().positive().optional(), id: z.number().int().positive().optional()
};
const output = (value: unknown, isError = false) => ({ isError, content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) }] });
function api(ctx?: ToolCtx) { if (!ctx?.client)
    throw Error('Authenticated store required.'); const { url, ck, cs } = resolveWooCredentials({}, ctx); return createCatalogService(url, ck, cs); }
function failure(error: unknown) { return output(error instanceof z.ZodError ? 'Invalid fields: ' + error.issues.map(item => item.path.join('.') + ': ' + item.message).join('; ') : (error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'The catalog request failed.'), true); }
export function registerCatalogTools(server: McpServer) {
    registerChatTool(server, 'describe_catalog_resource', {
        description: 'Discover validated writable fields and read filters for product, variation, category, tag, attribute, attribute_term, shipping_class, brand or review. Call before preparing unfamiliar resource changes. Variations need parent product ID; terms need parent attribute ID. Does not prove the store supports optional brands or plugin fields.',
        inputSchema: z.object({ resource: catalogResourceSchema }).strict(), chat: { display: 'hidden' }
    }, async ({ resource }) => output({
        resource, write_schema: describeInputSchema(catalogSchemas[resource as keyof typeof catalogSchemas]), filter_schema: describeInputSchema(catalogFilterSchema), instructions: 'Use exact core fields; read-only fields and unknown plugin fields are rejected. List/read first for real IDs. Product images arrays replace the gallery; use prepare_product_update.imageChange for preserving gallery images. Product creates require a name, variations a variable parent. Arrays replace the corresponding collection unless WooCommerce documents merge semantics. Metadata must be explicitly supplied by the user; do not invent extension keys. Product deletes default to trash; variation, review and taxonomy deletes are permanent. Reviews must be authentic user-supplied content.'
    }));
    registerChatTool(server, 'read_catalog', {
        description: 'Read one catalog item by ID or a filtered page. Resource paths are selected by the backend. parentId is required for variation and attribute_term. filters_json is a JSON object using fields returned by describe_catalog_resource. List results include next_page; never claim one page is all results when next_page exists. Use this to resolve real term/variation IDs and current data.',
        inputSchema: z.object({ ...selection, filters_json: z.string().max(10000).optional() }).strict(), chat: { display: 'hidden' }
    }, async (args, ctx) => { try {
        const data = await api(ctx).read(args as CatalogTarget, args.filters_json ? JSON.parse(args.filters_json) : {});
        const result: import('../types').MCPToolResponse = output(data);
        if (args.resource === 'product' || args.resource === 'variation') {
          const items = args.id ? [data] : data.items;
          const pagination = args.id ? '' : '<p class="product-page-note">Page ' + Number(data.page) + ' &middot; ' + items.length + ' shown. ' + (data.next_page ? 'More results are available; ask for page ' + Number(data.next_page) + '.' : 'No more pages for this query.') + '</p>';
          result.presentation = {html:formatCatalogProducts(args.resource, items, args.parentId) + pagination};
        }
        return result;
    }
    catch (error) {
        return failure(error);
    } });
    registerChatTool(server, 'prepare_catalog_change', {
        description: 'Prepare ONE create/update/delete for a catalog resource using the schema from describe_catalog_resource. data_json must be an object of writable fields, not a URL or credentials. Never executes a write; displays a confirmation preview. Use prepare_product_update for ordinary single-product updates and imageChange. Use this for product creation/deletion/metadata, variations and taxonomy CRUD. Clear arrays only when explicitly requested. permanent=false trashes products; variation, review and taxonomy deletions are always permanent. Restore a trashed product via update status. Never invent reviews.',
        inputSchema: z.object({
            ...selection, operation: z.enum(['create', 'update', 'delete']), data_json: z.string().max(100000).optional(), permanent: z.boolean().optional()
        }).strict(), chat: { terminal: true }
    }, async (args, ctx) => { try {
        if (!ctx)
            throw Error('Authenticated conversation required.');
        return output(await prepareCatalogChange(ctx, args as CatalogTarget, args.operation, args.data_json ? JSON.parse(args.data_json) : {}, args.permanent || false));
    }
    catch (error) {
        return failure(error);
    } });
    registerChatTool(server, 'prepare_catalog_batch', {
        description: 'Prepare a confirmed batch of 1-100 explicit catalog changes for ONE resource and parent. Discover the resource schema first. operations_json is {"create":[writable objects],"update":[{"id":real ID,...writable fields}],"delete":[real IDs]}. Use for multiple variations or structured changes to selected product IDs. Never invent IDs or expand a single-product request. Deletions require permanent=true and are permanent. Read current data before computing changes. Brands are individual-only. A batch can partially succeed; failed items are reported and never silently retried.',
        inputSchema: z.object({
            resource: catalogResourceSchema, parentId: z.number().int().positive().optional(), operations_json: z.string().max(200000), permanent: z.boolean().optional()
        }).strict(), chat: { terminal: true }
    }, async (args, ctx) => { try {
        if (!ctx)
            throw Error('Authenticated conversation required.');
        return output(await prepareCatalogBatch(ctx, args, JSON.parse(args.operations_json), args.permanent || false));
    }
    catch (error) {
        return failure(error);
    } });
}
