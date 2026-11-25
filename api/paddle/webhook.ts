import { allowMethods, handleApiError, sendJson } from '../_lib/http.js';
import { paddleClient, paddleConfig } from '../_lib/paddle.js';
import { processPaddleEvent } from '../_lib/paddleFulfillment.js';

export const config={api:{bodyParser:false}};
export default async function handler(req:any,res:any) {
  if(!allowMethods(req,res,['POST'])) return;
  try {
    const signature=req.headers['paddle-signature'];
    if(!signature) { sendJson(res,400,{error:'Missing signature'}); return; }
    // Verify exactly the bytes Paddle signed. Never use a parsed req.body.
    let raw:string;
    if(typeof req.text==='function') raw=await req.text();
    else { const chunks:Uint8Array[]=[]; for await(const chunk of req) chunks.push(Buffer.from(chunk)); raw=Buffer.concat(chunks).toString('utf8'); }
    const event=await paddleClient().webhooks.unmarshal(raw,paddleConfig().secret,signature);
    await processPaddleEvent(event);
    sendJson(res,200,{received:true});
  } catch(error) { handleApiError(res,error); }
}
