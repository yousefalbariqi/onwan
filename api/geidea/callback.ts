import { allowMethods, handleApiError, sendJson } from '../_lib/http.js';
import { handleGeideaCallback } from '../_lib/geidea.js';

// Geidea posts here when an order reaches a final state. The body is only a hint:
// handleGeideaCallback re-reads the order from Geidea before anything is published.
export default async function handler(req:any,res:any) {
  if(!allowMethods(req,res,['POST'])) return;
  try {
    let body:any=req.body;
    if(typeof req.text==='function') body=JSON.parse(await req.text() || '{}');
    await handleGeideaCallback(body);
    sendJson(res,200,{received:true});
  } catch(error) { handleApiError(res,error); }
}
