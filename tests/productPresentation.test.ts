import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {setupAllTools} from '../src/mcp/tools';
import {executeTool} from '../src/mcp/tools/registry';
import {runToolConversation} from '../src/mcp/llm/toolCalling';
const product={id:16,name:'QA-test01-Shirt-A',sku:'QA-test01-A',price:'100',status:'draft',stock_status:'instock',images:[],categories:[],tags:[]};

test('catalog product/variation reads render cards while preserving structured model data and pagination',async()=>{
 const http=createServer((req,res)=>{res.setHeader('content-type','application/json');res.setHeader('x-wp-totalpages','2');const path=new URL(req.url!,'http://localhost').pathname;res.end(JSON.stringify(path.includes('categories')?[{id:3,name:'Summer'}]:path.includes('variations')?[{id:7,price:'89',status:'draft',attributes:[{name:'Color',option:'Blue'}],image:{src:'https://example.com/blue.jpg'}}]:path.endsWith('/16')?product:[product]));});
 await new Promise<void>(resolve=>http.listen(0,'127.0.0.1',resolve));
 const instance=new McpServer({name:'product-presentation',version:'1'});setupAllTools(instance);
 const ctx={client:{id:'1',clientKey:'test',wooUrl:'http://127.0.0.1:'+(http.address() as import('node:net').AddressInfo).port,wooCk:'test',wooCs:'test'},sessionKey:'1:presentation'};
 try{
  const list=await executeTool(instance,'read_catalog',{resource:'product',filters_json:'{"per_page":1}'},ctx);
  assert.match(list.presentation!.html,/product-preview/);assert.match(list.presentation!.html,/ask for page 2/);
  assert.equal(JSON.parse(list.content[0].text).items[0].id,16);
  const single=await executeTool(instance,'read_catalog',{resource:'product',id:16},ctx);assert.match(single.presentation!.html,/product-preview/);
  const variations=await executeTool(instance,'read_catalog',{resource:'variation',parentId:42},ctx);assert.match(variations.presentation!.html,/product-preview/);assert.match(variations.presentation!.html,/Variation #7/);assert.match(variations.presentation!.html,/Blue/);
  const category=await executeTool(instance,'read_catalog',{resource:'category'},ctx);assert.equal(category.presentation,undefined);
  let turn=0;
  const result=await runToolConversation({server:instance,ctx,history:[{role:'user',content:'Show my products'}],complete:async request=>{
   if(turn++===0)return {choices:[{message:{role:'assistant',content:null,tool_calls:[{id:'list',type:'function',function:{name:'read_catalog',arguments:JSON.stringify({resource:'product',filters_json:'{"per_page":1}'})}}]}}]} as any;
   const tool=request.messages.find(message=>message.role==='tool')!;
   const data=JSON.parse(JSON.parse(String(tool.content)).output);assert.equal(data.items[0].id,16);
   assert.doesNotMatch(String(tool.content),/product-preview/);
   return {choices:[{message:{role:'assistant',content:'Plain duplicate product summary'}}]} as any;
  }});
  assert.match(result.text,/product-preview/);assert.match(result.text,/ask for page 2/);assert.doesNotMatch(result.text,/Plain duplicate/);
 }finally{await new Promise<void>(resolve=>http.close(()=>resolve()));}
});
import {requiresFreshProductRead} from '../src/mcp/llm/toolCalling';
test('current filtered product searches require fresh reads even after products appeared in history',async()=>{
 assert.equal(requiresFreshProductRead('Find in-stock shirts priced between 50 and 150.'),true);
 assert.equal(requiresFreshProductRead('Show my products.'),true);
 assert.equal(requiresFreshProductRead('Find the chat where we discussed product prices.'),false);
 assert.equal(requiresFreshProductRead('Find the shirt and increase its price by 10%.'),false);
 const server=new McpServer({name:'fresh-product-query',version:'1'});setupAllTools(server);
 const ctx={client:{id:'1',clientKey:'test'},sessionKey:'1:fresh-product-query'};
 const result=await runToolConversation({server,ctx,history:[{role:'user',content:'Show my products.'},{role:'assistant',content:'QA-test01-Shirt-A costs 100 and QA-test02-Shirt-B costs 80.'},{role:'user',content:'Find in-stock shirts priced between 50 and 150.'}],complete:async request=>{
  assert.equal(request.tool_choice,'required');assert.ok(request.tools?.every(tool=>tool.type==='function'&&['read_catalog','describe_catalog_resource'].includes(tool.function.name)));
  // Even if a provider ignores required tool choice, stale prose must not be displayed as current search results.
  return {choices:[{message:{role:'assistant',content:'I found two in-stock shirts: QA-test01-Shirt-A and QA-test02-Shirt-B.'}}]} as any;
 }});
 assert.match(result.text,/could not retrieve fresh/);assert.doesNotMatch(result.text,/I found two|QA-test01/);
});
