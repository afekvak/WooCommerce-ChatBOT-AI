import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {setupAllTools} from '../src/mcp/tools';
import {executeTool} from '../src/mcp/tools/registry';
import {handleUserMessage} from '../src/mcp/llm/router';
import {ConversationHistory} from '../src/mcp/llm/history';
import type {ConversationStore} from '../src/db/conversations';
import {getPendingProductName,clearPendingProductName} from '../src/mcp/llm/wizards/productCreation';
import {getWizard,clearWizard} from '../src/mcp/llm/wizards/createProductWizard/state';
import {getCatalogChange,clearCatalogChange} from '../src/mcp/llm/wizards/catalogWizard';

test('Add a product guides through missing fields, supports skip and advanced choices, and cancels without creating',async()=>{
 const writes:any[]=[];
 const http=createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;if(req.method==='POST')writes.push(JSON.parse(raw));res.setHeader('content-type','application/json');res.end(JSON.stringify({id:104,...(raw?JSON.parse(raw):{})}));});
 await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
 const instance=new McpServer({name:'guided-followup',version:'1'});setupAllTools(instance);
 const client={id:'1',clientKey:'test',wooUrl:'http://127.0.0.1:'+(http.address() as import('node:net').AddressInfo).port,wooCk:'test',wooCs:'test'};
 const turns:Array<{role:string;content:string}>=[];
 const store={append:async(_client:string,_chat:string,role:string,content:string)=>{turns.push({role,content});return String(turns.length);},messages:async()=>turns} as unknown as ConversationStore;
 const session='guided-followup',key='1:'+session;
 const context={client,history:new ConversationHistory(store,'1',session)};
 const send=(message:string)=>handleUserMessage(message,instance,context,session);
 const skipBasics=async()=>{let count=0;while(getWizard(key)?.stage==='basic'){assert.ok(++count<30);await send('skip');}};
 try{
  assert.match((await send('Add a product')).text,/product name/);
  const next=await send('test04');assert.match(next.text,/Regular price/);assert.doesNotMatch(next.text,/WIZARD_CONFIRM_META/);
  assert.equal(getPendingProductName(key),undefined);assert.equal(getWizard(key)?.data.name,'test04');assert.equal(getCatalogChange(key),undefined);
  assert.match((await send('100')).text,/Sale price/);
  await skipBasics();assert.equal(getWizard(key)?.stage,'ask_advanced');assert.equal(writes.length,0);
  assert.match((await send('none')).text,/WIZARD_CONFIRM_META/);
  await send('cancel');assert.equal(getWizard(key),undefined);assert.equal(writes.length,0);

  await executeTool(instance,'prepare_create_product',{data:{sku:'QA-04',regular_price:'100',manage_stock:true,stock_quantity:20}},{client,sessionKey:key});
  assert.match((await send('test04-details')).text,/Sale price/);
  await skipBasics();assert.equal(getWizard(key)?.data.sku,'QA-04');assert.equal(getWizard(key)?.data.stock_quantity,20);
  await send('none');assert.equal(writes.length,0);
  await send('__WIZ_CONFIRM__:draft');assert.equal(writes.length,1);
  assert.equal(writes[0].name,'test04-details');assert.equal(writes[0].regular_price,'100');assert.equal(writes[0].stock_quantity,20);assert.equal(writes[0].sku,'QA-04');assert.equal(writes[0].status,'draft');

  await send('Add a product');await send('advanced-test');await skipBasics();
  assert.match((await send('full')).text,/Tax status/);
  await send('cancel');assert.equal(writes.length,1);
  await send('Add a product');await send('cancel');assert.equal(getPendingProductName(key),undefined);
 }finally{clearPendingProductName(key);clearWizard(key);clearCatalogChange(key);await new Promise<void>(resolve=>http.close(()=>resolve()));}
});
