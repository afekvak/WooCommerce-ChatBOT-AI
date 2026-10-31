import type {ToolCtx} from '../../types';
import {productChangesSchema} from '../../../services/productSchema';
import {startCreateProductWizard} from './createProductWizard/handler';
const pendingNames=new Map<string,{data:Record<string,unknown>;expires:number}>();
export const getPendingProductName=(key:string)=>pendingNames.get(key);
export const clearPendingProductName=(key:string)=>{pendingNames.delete(key);};
export function askProductName(key:string,data:Record<string,unknown>={}) {
  pendingNames.set(key,{data:productChangesSchema.parse(data),expires:Date.now()+15*60*1000});
  return 'What is the product name? I will use the details already supplied and guide you through the missing fields. You can skip optional fields or cancel.';
}
export async function answerProductName(ctx:ToolCtx,message:string) {
  if(!ctx.client||!ctx.sessionKey)throw Error('Authenticated conversation required.');
  const pending=pendingNames.get(ctx.sessionKey);
  if(!pending)return 'No product creation is waiting for a name.';
  if(/^(cancel|no)$/i.test(message.trim())){pendingNames.delete(ctx.sessionKey);return 'Product creation cancelled. Nothing was created.';}
  if(pending.expires<Date.now()){pendingNames.delete(ctx.sessionKey);return 'This product request expired. Ask to create the product again.';}
  const name=message.trim().replace(/^(?:call it|name it|the name is)\s+/i,'').trim();
  if(!name)return 'Please provide a product name, or say cancel.';
  const nextQuestion=startCreateProductWizard(ctx.sessionKey,{guided:true,data:{...pending.data,name}});
  pendingNames.delete(ctx.sessionKey);
  return nextQuestion;
}
