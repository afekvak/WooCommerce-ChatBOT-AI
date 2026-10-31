import assert from 'node:assert/strict';
import test from 'node:test';
import {startBulkUpdateWizard,handleBulkUpdateWizardStep} from '../src/mcp/llm/wizards/bulkUpdateWizard/handler';
import {getBulkWizard,clearBulkWizard} from '../src/mcp/llm/wizards/bulkUpdateWizard/state';
import {formatProducts} from '../src/utils/formatWoo';
test('bulk direction reuses the percentage supplied before scope selection',async()=>{
 const session='test:bulk-percent';
 try {
  await startBulkUpdateWizard(session,{percent:10,field:'regular_price'});
  await handleBulkUpdateWizardStep(session,'all');
  const preview=await handleBulkUpdateWizardStep(session,'increase');
  assert.equal(getBulkWizard(session)?.percent,10);
  assert.equal(getBulkWizard(session)?.stage,'confirm');
  assert.match(preview.reply,/WIZARD_CONFIRM_META/);
 }finally{clearBulkWizard(session);}
});
test('product listings put detailed fields behind a closed disclosure',()=>{
 const html=formatProducts([{id:15,name:'Test Wizard Tshirt',price:'79.90',status:'draft',stock_status:'instock',images:[],categories:[],tags:[]}]);
 assert.match(html,/product-preview-main/);
 assert.match(html,/<details class="product-more"><summary>View details/);
 assert.doesNotMatch(html,/<details[^>]*\sopen[ >]/);
});

import {handleUserMessage} from '../src/mcp/llm/router';
import {ConversationHistory} from '../src/mcp/llm/history';
import type {ConversationStore} from '../src/db/conversations';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
test('asking for the last message during a bulk workflow answers without changing its state',async()=>{
 const session='1:side-question';const messages=[{role:'user',content:'increase its price by 10%'}];
 const store={append:async(_c:string,_id:string,role:string,content:string)=>{messages.push({role,content});return '2';},messages:async()=>messages} as unknown as ConversationStore;
 try {
  await startBulkUpdateWizard(session,{percent:10,field:'regular_price'});
  const before=structuredClone(getBulkWizard(session));
  const result=await handleUserMessage('what was my last message',new McpServer({name:'side-test',version:'1'}),{client:{id:'1',clientKey:'test'},history:new ConversationHistory(store,'1','side-question')},'side-question');
  assert.match(result.text,/increase its price by 10%/);
  assert.deepEqual(getBulkWizard(session),before);
 }finally{clearBulkWizard(session);}
});
import {formatSingleProduct,formatProductBySku} from '../src/utils/formatWoo';
test('name, ID and SKU lookup cards use the same compact product presentation',()=>{
 const product={id:16,name:'QA-test01-Shirt-A',sku:'QA-test01-A',price:'100',status:'draft',images:[],categories:[],tags:[]};
 const expected=formatProducts([product]);
 assert.equal(formatSingleProduct(product),expected);
 assert.equal(formatProductBySku(product),expected);
 assert.match(expected,/product-preview/);
 assert.doesNotMatch(expected,/<details[^>]*\sopen[ >]/);
});
