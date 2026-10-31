import {formatCatalogProducts} from "../../../utils/formatWoo";
import type { ToolCtx } from '../../types';
import { catalogPayload, catalogBatchPayload, catalogPath, validateVariationParent, createCatalogService, type CatalogTarget, type CatalogService } from '../../../services/catalogService';
import { resolveWooCredentials } from '../../tools/woo/wooCredentials';
export interface CatalogChange {
    target: CatalogTarget;
    operation: 'create' | 'update' | 'delete' | 'batch';
    data: Record<string, unknown>;
    permanent: boolean;
    expires: number;
}
const pending = new Map<string, CatalogChange>();
export const getCatalogChange = (key: string) => pending.get(key);
export const clearCatalogChange = (key: string) => { pending.delete(key); };
function service(ctx: ToolCtx) { const { url, ck, cs } = resolveWooCredentials({}, ctx); return createCatalogService(url, ck, cs); }
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\[\[/g, '&#91;&#91;');
export async function prepareCatalogChange(ctx: ToolCtx, target: CatalogTarget, operation: 'create' | 'update' | 'delete', input: unknown, permanent = false, api: CatalogService = service(ctx)) {
    if (!ctx.client || !ctx.sessionKey)
        throw Error('Authenticated conversation required.');
    catalogPath(target);
    if (operation === 'create' && target.id)
        throw Error('Create must not specify an existing resource ID.');
    if (operation !== 'create' && !target.id)
        throw Error('An existing resource ID is required.');
    if (!input || typeof input !== "object" || Array.isArray(input))
        throw Error("data_json must contain a JSON object.");
    let data: Record<string, unknown> = {};
    if (operation !== 'delete') {
        data = catalogPayload(target.resource, operation, input);
        if (operation === 'create' && ['product', 'variation'].includes(target.resource) && data.status === undefined)
            data.status = 'draft';
    }
    else if (input && Object.keys(input as object).length)
        throw Error('Delete takes no field changes.');
    if (operation !== 'delete' && permanent)
        throw Error('permanent is only for deletion.');
    const before = target.id ? await api.read(target) : null;
    if (target.resource === 'variation' && operation === 'create') {
        const parent = await api.read({ resource: 'product', id: target.parentId });
        validateVariationParent(parent, data.attributes as any[]);
    }
    const permanentDelete = operation === 'delete' && (permanent || !['product'].includes(target.resource));
    const description = operation === 'delete'
        ? (permanentDelete ? 'Permanently delete ' : 'Move to trash: ') + target.resource + ' #' + target.id + '. This may affect linked products.'
        : 'Prepare ' + operation + ' for ' + target.resource + (target.id ? ' #' + target.id : '') + (target.parentId ? ' under #' + target.parentId : '') + '.';
    const summary: Record<string, string> = {};
    const printable = (value: unknown) => value === undefined ? '(none)' : typeof value === 'object' ? JSON.stringify(value) : String(value);
    if (operation === 'delete')
        summary.deletion = permanentDelete ? 'Permanent; cannot be undone' : 'Move to trash';
    else
        for (const [key, value] of Object.entries(data))
            summary[key] = printable(before?.[key]) + ' -> ' + printable(value);
    pending.set(ctx.sessionKey, {
        target: structuredClone(target), operation, data: structuredClone(data), permanent, expires: Date.now() + 15 * 60 * 1000
    });
    const meta = { type: 'wizard_confirm', wizard: 'catalog', action: operation, description, summary };
    return escape(description) + '\nReview the changes, then confirm or cancel.\n[[WIZARD_CONFIRM_META]]' + JSON.stringify(meta) + '[[END_WIZARD_CONFIRM_META]]';
}
export async function continueCatalogChange(ctx: ToolCtx, message: string, api?: CatalogService) {
    if (!ctx.client || !ctx.sessionKey)
        throw Error('Authenticated conversation required.');
    const change = pending.get(ctx.sessionKey);
    if (!change)
        return { done: true, reply: 'No catalog change is pending.' };
    if (/^(cancel|no)$/i.test(message.trim())) {
        pending.delete(ctx.sessionKey);
        return { done: true, reply: 'Catalog change cancelled. Nothing changed.' };
    }
    if (change.expires < Date.now()) {
        pending.delete(ctx.sessionKey);
        return { done: true, reply: 'This preview expired. Ask for the change again to get a fresh preview.' };
    }
    if (!/^(confirm|yes)$/i.test(message.trim()))
        return {
            done: false, reply: 'A catalog change is awaiting confirmation. Confirm or cancel it first; you can still ask questions.'
        };
    pending.delete(ctx.sessionKey);
    try {
        if (change.operation === 'batch') {
            const result = await (api || service(ctx)).batch(change.target, change.data, change.permanent);
            let succeeded = 0;
            const products: any[] = [];
            const failures: string[] = [];
            for (const kind of ['create', 'update', 'delete']) {
                const expected = (change.data[kind] as unknown[]).length;
                const items = Array.isArray(result[kind]) ? result[kind] : [];
                for (let index = 0; index < expected; index++) {
                    const item = items[index];
                    if ((item?.id || (item?.deleted === true && item?.previous?.id)) && !item.error) {
                        succeeded++;
                        if (kind !== "delete" && ["product","variation"].includes(change.target.resource)) products.push(item);
                    }
                    else
                        failures.push(kind + ' item ' + (index + 1) + ': ' + (item?.error?.message || 'WooCommerce did not report success.'));
                }
            }
            return {
                done: true, reply: escape('Batch finished: ' + succeeded + ' succeeded, ' + failures.length + ' failed.' + (failures.length ? ' ' + failures.join(' ') : '')) + (products.length ? formatCatalogProducts(change.target.resource as 'product'|'variation', products, change.target.parentId) : '')
            };
        }
        const result = await (api || service(ctx)).write(change.target, change.operation, change.data, change.permanent);
        if (result?.error)
            throw Error(result.error.message || 'WooCommerce rejected the operation.');
        return {
            done: true, reply: 'Catalog ' + change.operation + ' completed for ' + change.target.resource + ' #' + (result?.id || change.target.id) + '.' + (change.operation !== 'delete' && ['product','variation'].includes(change.target.resource) ? formatCatalogProducts(change.target.resource as 'product'|'variation',[result],change.target.parentId) : '')
        };
    }
    catch (error) {
        return {
            done: true, reply: escape('WooCommerce could not complete the change: ' + ((error as any)?.response?.data?.message || (error instanceof Error ? error.message : 'Unknown error')))
        };
    }
}
export async function prepareCatalogBatch(ctx: ToolCtx, target: CatalogTarget, input: unknown, permanent = false, api: CatalogService = service(ctx)) {
    if (!ctx.client || !ctx.sessionKey)
        throw Error('Authenticated conversation required.');
    if (target.id)
        throw Error('A batch targets a collection, not an item ID.');
    catalogPath(target);
    const data = catalogBatchPayload(target.resource, input, permanent);
    if (target.resource === 'variation' && data.create.length) {
        const parent = await api.read({ resource: 'product', id: target.parentId });
        for (const item of data.create)
            validateVariationParent(parent, item.attributes);
    }
    const description = 'Prepare batch for ' + target.resource + ': ' + data.create.length + ' creates, ' + data.update.length + ' updates, ' + data.delete.length + ' permanent deletions. Batch results can partially succeed; this is not a transaction.';
    const summary: Record<string, string> = {};
    for (const kind of ['create', 'update', 'delete'] as const)
        if (data[kind].length)
            summary[kind] = JSON.stringify(data[kind]);
    pending.set(ctx.sessionKey, {
        target: structuredClone(target), operation: 'batch', data: structuredClone(data), permanent, expires: Date.now() + 15 * 60 * 1000
    });
    return escape(description) + '\nReview every target and value, then confirm or cancel.\n[[WIZARD_CONFIRM_META]]' + JSON.stringify({ type: 'wizard_confirm', wizard: 'catalog', action: 'batch', description, summary }) + '[[END_WIZARD_CONFIRM_META]]';
}
