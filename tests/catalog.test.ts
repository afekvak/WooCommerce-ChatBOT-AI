import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogService, catalogResources, catalogPath, catalogPayload, type CatalogApi, type CatalogResource } from '../src/services/catalogService';
import { applyImageChange, validateProductChanges } from '../src/services/productSchema';
import { prepareCatalogChange, continueCatalogChange, getCatalogChange, clearCatalogChange } from '../src/mcp/llm/wizards/catalogWizard';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { setupAllTools } from '../src/mcp/tools';
import { executeTool } from '../src/mcp/tools/registry';
const creates: Record<CatalogResource, Record<string, unknown>> = {
    product: { name: 'Shirt', images: [{ src: 'https://example.com/shirt.jpg' }], categories: [{ id: 3 }] }, variation: { regular_price: '35', attributes: [{ id: 2, option: 'Blue' }] }, category: { name: 'Summer', image: { src: 'https://example.com/summer.jpg' } }, tag: { name: 'Sale' }, attribute: { name: 'Color', type: 'select' }, attribute_term: { name: 'Blue' }, shipping_class: { name: 'Heavy' }, brand: { name: 'Example brand' }, review: {
        product_id: 42, review: 'Actual supplied review', reviewer: 'Store user', reviewer_email: 'user@example.com', rating: 4
    }
};
function fixture() {
    const writes: any[] = [];
    const reads: any[] = [];
    const api: CatalogApi = {
        get: async (path, params) => { reads.push({ path, params }); return {
            data: path.endsWith('/42') ? {
                id: 42, name: 'Shirt', type: 'variable', attributes: [{ id: 2, name: 'Color', variation: true, options: ['Blue'] }], images: [{ id: 8 }, { id: 9 }]
            } : path.match(/\/\d+$/) ? { id: 7, name: 'Existing' } : [{ id: 7, name: 'Existing' }], headers: { 'x-wp-totalpages': '2' }
        }; },
        post: async (path, data) => { writes.push({ method: 'post', path, data }); return { data: { id: 7, ...data as object } }; },
        put: async (path, data) => { writes.push({ method: 'put', path, data }); return { data: { id: 7, ...data as object } }; },
        delete: async (path, params) => { writes.push({ method: 'delete', path, params }); return { data: { id: 7 } }; }
    };
    return { api, service: new CatalogService(api), writes, reads };
}
const ctx = { client: { id: '1', clientKey: 'test' }, sessionKey: '1:catalog-test' };
test('main image replacement, append, selected removal and clear preserve the intended gallery', () => {
    const original = { images: [{ id: 8, src: 'https://example.com/old.jpg' }, { id: 9, src: 'https://example.com/gallery.jpg' }] };
    assert.deepEqual(applyImageChange(original, { mode: 'replace_featured', images: [{ src: 'https://example.com/new.jpg', alt: 'New shirt' }] }), [{ src: 'https://example.com/new.jpg', alt: 'New shirt' }, { id: 9 }]);
    assert.deepEqual(applyImageChange(original, { mode: 'append', images: [{ id: 10 }] }), [{ id: 8 }, { id: 9 }, { id: 10 }]);
    assert.deepEqual(applyImageChange(original, { mode: 'remove', images: [{ src: 'https://example.com/gallery.jpg' }] }), [{ id: 8 }]);
    assert.deepEqual(applyImageChange(original, { mode: 'clear', images: [] }), []);
    assert.throws(() => applyImageChange(original, { mode: 'remove', images: [{ id: 100 }] }), /not in/);
    assert.throws(() => applyImageChange(original, { mode: 'replace_featured', images: [] }), /exactly one/);
    assert.throws(() => validateProductChanges({ images: [{ src: 'javascript:alert(1)' }] }));
    assert.throws(() => validateProductChanges({ images: [{}] }));
    assert.throws(() => validateProductChanges({ price: '10' }));
    assert.throws(() => validateProductChanges({ categories: [{ name: 'invented' }] }));
    assert.throws(() => validateProductChanges({ images: [{ id: 8, src: 'https://example.com/conflict.jpg' }] }));
});
test('resource paths require real parent IDs and reject unadvertised routes', () => {
    assert.equal(catalogPath({ resource: 'variation', parentId: 42, id: 7 }), 'products/42/variations/7');
    assert.equal(catalogPath({ resource: 'attribute_term', parentId: 2, id: 7 }), 'products/attributes/2/terms/7');
    assert.throws(() => catalogPath({ resource: 'variation', id: 7 }), /parent/);
    assert.throws(() => catalogPath({ resource: 'product', id: 1.5 }));
    assert.throws(() => catalogPath({ resource: 'orders' as CatalogResource }));
    assert.throws(() => catalogPayload('category', 'update', { consumer_secret: 'bad' }));
    assert.throws(() => catalogPayload('product', 'create', {}));
});
for (const resource of catalogResources)
    test(resource + ' CRUD is scoped, validated, previewed and confirmed', async () => {
        const f = fixture();
        const parentId = resource === 'variation' ? 42 : resource === 'attribute_term' ? 2 : undefined;
        const target = { resource, parentId };
        try {
            const preview = await prepareCatalogChange(ctx, target, 'create', creates[resource], false, f.service);
            assert.match(preview, /WIZARD_CONFIRM_META/);
            assert.equal(f.writes.length, 0);
            if (resource === 'product' || resource === 'variation')
                assert.equal(getCatalogChange(ctx.sessionKey)?.data.status, 'draft');
            const createdReply = await continueCatalogChange(ctx, 'confirm', f.service);
            if (resource === 'product' || resource === 'variation') assert.match(createdReply.reply, /product-preview/);
            assert.equal(f.writes.length, 1);
            assert.equal(f.writes[0].method, 'post');
            await continueCatalogChange(ctx, 'confirm', f.service);
            assert.equal(f.writes.length, 1);
            const change = resource === 'review' ? { rating: 5 } : resource === 'variation' ? { sale_price: '30' } : { name: 'Changed' };
            await prepareCatalogChange(ctx, { ...target, id: 7 }, 'update', change, false, f.service);
            await continueCatalogChange(ctx, 'cancel', f.service);
            assert.equal(f.writes.length, 1);
            await prepareCatalogChange(ctx, { ...target, id: 7 }, 'update', change, false, f.service);
            await continueCatalogChange(ctx, 'confirm', f.service);
            assert.equal(f.writes.length, 2);
            assert.deepEqual(f.writes[1].data, change);
            await prepareCatalogChange(ctx, { ...target, id: 7 }, 'delete', {}, false, f.service);
            assert.equal(f.writes.length, 2);
            await continueCatalogChange(ctx, 'confirm', f.service);
            assert.equal(f.writes[2].method, 'delete');
            assert.equal(f.writes[2].params.force, !['product'].includes(resource));
            const listing = await f.service.read(target, { page: 1, per_page: 1 });
            assert.equal(listing.items.length, 1);
            assert.equal((await f.service.read({ ...target, id: 7 })).id, 7);
        }
        finally {
            clearCatalogChange(ctx.sessionKey);
        }
    });
test('catalog discovery returns writable schemas for every resource without exposing raw writes', async () => {
    const server = new McpServer({ name: 'catalog-discovery', version: '1' });
    setupAllTools(server);
    for (const resource of catalogResources) {
        const result = await executeTool(server, 'describe_catalog_resource', { resource }, ctx);
        assert.equal(result.isError, false);
        const schema = JSON.parse(result.content[0].text);
        assert.equal(schema.write_schema.additionalProperties, false);
        assert.ok(schema.write_schema.properties);
    }
    const invalid = await executeTool(server, 'prepare_catalog_change', { resource: 'product', operation: 'update', id: 42, data_json: '{"url":"https://attacker.example"}' }, ctx);
    assert.equal(invalid.isError, true);
    assert.equal(getCatalogChange(ctx.sessionKey), undefined);
});
test('pagination, filters, default-attribute values and structured fields keep their types', async () => {
    const f = fixture();
    const listing = await f.service.read({ resource: 'product' }, { page: 1, per_page: 20, include: [7, 8], featured: false, stock_status: 'instock' });
    assert.equal(listing.next_page, 2);
    assert.equal(f.reads[0].params.include, '7,8');
    assert.equal(f.reads[0].params.featured, false);
    await assert.rejects(f.service.read({ resource: 'category' }, { stock_status: 'instock' }), /Unsupported/);
    const changes = validateProductChanges({
        dimensions: { length: '12.5' }, featured: false, attributes: [{ id: 2, options: ['Blue'], variation: true }], default_attributes: [{ id: 2, option: 'Blue' }], downloads: [{ file: 'https://example.com/file.zip' }]
    });
    assert.equal(changes.featured, false);
    assert.equal(changes.attributes?.[0].variation, true);
});
import { catalogBatchPayload } from '../src/services/catalogService';
import { prepareCatalogBatch } from '../src/mcp/llm/wizards/catalogWizard';
test('batch changes reject duplicate targets and require explicit permanent deletion', () => {
    assert.throws(() => catalogBatchPayload('product', { delete: [7] }), /permanent/);
    assert.throws(() => catalogBatchPayload('product', { update: [{ id: 7, name: 'New' }], delete: [7] }, true), /same batch/);
    assert.throws(() => catalogBatchPayload('product', { create: Array.from({ length: 101 }, () => ({ name: 'X' })) }), /100/);
    assert.throws(() => catalogBatchPayload('variation', { update: [{ id: 7, price: '9' }] }));
    assert.throws(() => catalogBatchPayload('brand', { create: [{ name: 'X' }] }));
    assert.deepEqual(catalogBatchPayload('product', { create: [{ name: 'New' }] }).create[0], { name: 'New', status: 'draft' });
});
test('batch preparation writes nothing; confirmed partial results are reported accurately', async () => {
    const f = fixture();
    f.api.post = async (path, data) => { f.writes.push({ path, data }); return { data: { update: [{ id: 7 }, { error: { message: 'Invalid SKU' } }] } }; };
    await prepareCatalogBatch(ctx, { resource: 'product' }, { update: [{ id: 7, name: 'A' }, { id: 8, name: 'B' }] }, false, f.service);
    assert.equal(f.writes.length, 0);
    const result = await continueCatalogChange(ctx, 'confirm', f.service);
    assert.equal(f.writes[0].path, 'products/batch');
    assert.match(result.reply, /1 succeeded, 1 failed/);
    assert.match(result.reply, /Invalid SKU/);
    assert.equal(getCatalogChange(ctx.sessionKey), undefined);
});
import { createServer } from 'node:http';
import { startUpdateProductWizard, handleUpdateProductWizardStep } from '../src/mcp/llm/wizards/updateProductWizard/handler';
import { getUpdateWizard, clearUpdateWizard } from '../src/mcp/llm/wizards/updateProductWizard/state';
import { handleUserMessage } from '../src/mcp/llm/router';
import { ConversationHistory } from '../src/mcp/llm/history';
import type { ConversationStore } from '../src/db/conversations';
test('image URL updates retain other gallery IDs and write only after confirmation', async () => {
    let changed = false;
    const writes: any[] = [];
    const product = {
        id: 42, name: 'Blue shirt', images: [{ id: 8, src: 'https://example.com/old.jpg' }, { id: 9, src: 'https://example.com/gallery.jpg' }], categories: [], tags: []
    };
    const server = createServer(async (req, res) => { let raw = ''; for await (const chunk of req)
        raw += chunk; res.setHeader('Content-Type', 'application/json'); if (req.method === 'PUT')
        writes.push(JSON.parse(raw)); res.end(JSON.stringify({
        ...product, ...(changed ? { images: [{ id: 99, src: 'https://example.com/newer.jpg' }] } : {}), ...(raw ? JSON.parse(raw) : {})
    })); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const context = {
        client: {
            id: '1', clientKey: 'test', wooUrl: 'http://127.0.0.1:' + (server.address() as import('node:net').AddressInfo).port, wooCk: 'test', wooCs: 'test'
        }
    };
    const key = '1:image-update';
    try {
        const preview = await startUpdateProductWizard(key, { id: 42, imageChange: { mode: 'replace_featured', images: [{ src: 'https://example.com/new.jpg' }] } }, context);
        assert.match(preview.reply, /https:\/\/example.com\/new.jpg/);
        assert.doesNotMatch(preview.reply, /\[object Object\]/);
        assert.deepEqual(getUpdateWizard(key)?.payload.images, [{ src: 'https://example.com/new.jpg' }, { id: 9 }]);
        assert.equal(writes.length, 0);
        await handleUpdateProductWizardStep(key, 'confirm', context);
        assert.deepEqual(writes, [{ images: [{ src: 'https://example.com/new.jpg' }, { id: 9 }] }]);
        await startUpdateProductWizard(key, { id: 42, imageChange: { mode: 'replace_featured', images: [{ id: 10 }] } }, context);
        changed = true;
        const stale = await handleUpdateProductWizardStep(key, 'confirm', context);
        assert.match(stale.reply, /changed after the preview/);
        assert.equal(writes.length, 1);
        changed = false;
        const session = 'catalog-confirm-route';
        const toolCtx = { ...context, sessionKey: '1:' + session };
        const instance = new McpServer({ name: 'catalog-route', version: '1' });
        setupAllTools(instance);
        const prepared = await executeTool(instance, 'prepare_catalog_change', { resource: 'product', id: 42, operation: 'update', data_json: JSON.stringify({ featured: true }) }, toolCtx);
        assert.equal(prepared.isError, false);
        assert.equal(writes.length, 1);
        const store = { append: async () => '2' } as unknown as ConversationStore;
        await handleUserMessage('confirm', instance, { ...context, history: new ConversationHistory(store, '1', session) }, session);
        assert.deepEqual(writes[1], { featured: true });
    }
    finally {
        clearUpdateWizard(key);
        clearCatalogChange('1:catalog-confirm-route');
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});
import {runToolConversation} from '../src/mcp/llm/toolCalling';
test('nullable optional fields and nested image nulls never create unintended resets',async()=>{
 const {createServer}=await import('node:http');
 const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:42,name:'Shirt',images:[{id:8},{id:9}]}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const key='1:nullable-image';
 try{
  const instance=new McpServer({name:'nullable-image',version:'1'});setupAllTools(instance);
  await runToolConversation({server:instance,ctx:{client:{id:'1',clientKey:'test',wooUrl:'http://127.0.0.1:'+(server.address() as import('node:net').AddressInfo).port,wooCk:'test',wooCs:'test'},sessionKey:key},history:[{role:'user',content:'Replace main image of product 42'}],complete:async()=>({choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'image',type:'function',function:{name:'prepare_product_update',arguments:JSON.stringify({id:42,sku:null,changes:{date_on_sale_from:null,customs_country_of_origin:null},imageChange:{mode:'replace_featured',images:[{id:null,src:'https://example.com/new.jpg',name:null,alt:null}]}})}}]}}]} as any)});
  assert.deepEqual(getUpdateWizard(key)?.payload,{images:[{src:'https://example.com/new.jpg'},{id:9}]});
 }finally{clearUpdateWizard(key);await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
test('expired catalog previews never write',async()=>{
 const f=fixture();await prepareCatalogChange(ctx,{resource:'tag'},'create',{name:'New tag'},false,f.service);
 getCatalogChange(ctx.sessionKey)!.expires=Date.now()-1;
 const reply=await continueCatalogChange(ctx,'confirm',f.service);
 assert.match(reply.reply,/expired/);assert.equal(f.writes.length,0);assert.equal(getCatalogChange(ctx.sessionKey),undefined);
});

test('complete product creation details go directly to a preview and execute only on confirmation',async()=>{
 const writes:any[]=[];
 const server=createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;res.setHeader('Content-Type','application/json');if(req.method==='POST')writes.push(JSON.parse(body));res.end(JSON.stringify({id:101,...(body?JSON.parse(body):{})}));});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const key='1:seeded-create';const instance=new McpServer({name:'seeded-create',version:'1'});setupAllTools(instance);
 const context={client:{id:'1',clientKey:'test',wooUrl:'http://127.0.0.1:'+(server.address() as import('node:net').AddressInfo).port,wooCk:'test',wooCs:'test'},sessionKey:key};
 const data={name:'QA-test01-Shirt-A',type:'simple',status:'draft',sku:'QA-test01-A',regular_price:'100',manage_stock:true,stock_quantity:20};
 try{
  const result=await executeTool(instance,'prepare_create_product',{data},context);
  assert.match(result.content[0].text,/WIZARD_CONFIRM_META/);
  assert.doesNotMatch(result.content[0].text,/How would you like to proceed|Type "wizard"/);
  assert.deepEqual(getCatalogChange(key)?.data,data);assert.equal(writes.length,0);
  await continueCatalogChange(context,'confirm');assert.deepEqual(writes,[data]);
  await continueCatalogChange(context,'confirm');assert.equal(writes.length,1);
  const missingName=await executeTool(instance,'prepare_create_product',{data:{regular_price:'100',stock_quantity:20}},context);
  assert.notEqual(missingName.isError,true);assert.match(missingName.content[0].text,/product name/);
 }finally{clearCatalogChange(key);await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
