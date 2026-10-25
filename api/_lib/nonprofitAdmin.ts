import type { Handler } from './admin.js';
import { audit } from './admin.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { notifyNonprofit } from './nonprofit.js';
export const nonprofitAdminHandlers: Record<string, Handler> = {
  'nonprofits.list': { access:'staff', run:async()=> ({ requests:(await pool.query(`select id,request_number,user_id,organization_name,contact_name,phone,email,status,email_status,created_at from nonprofit_quote_requests order by created_at desc limit 200`)).rows }) },
  'nonprofits.get': { access:'staff', run:async(params)=> {
    const row=(await pool.query('select * from nonprofit_quote_requests where id=$1',[params.id])).rows[0];
    if(!row) throw new HttpError(404,'الطلب غير موجود.');
    return { request:row };
  } },
  'nonprofits.update': { access:'staff', run:async(params,staff)=> {
    if(!['pending','contacted','agreed','cancelled'].includes(params.status)) throw new HttpError(400,'حالة الطلب غير صحيحة.');
    const result=await pool.query('update nonprofit_quote_requests set status=$2,admin_notes=$3,updated_at=now() where id=$1 returning id',[params.id,params.status,String(params.adminNotes??'').slice(0,8000)]);
    if(!result.rows[0]) throw new HttpError(404,'الطلب غير موجود.');
    await audit(staff,'nonprofits.update',{type:'nonprofit',id:params.id,label:params.status});
    return { saved:true };
  } },
  'nonprofits.retryEmail': { access:'staff', run:async(params,staff)=> {
    const row=await pool.query("update nonprofit_quote_requests set email_attempts=0,email_status='pending' where id=$1 and email_status='failed' returning id",[params.id]);
    if(!row.rows[0]) throw new HttpError(409,'لا يوجد إشعار فاشل لإعادة إرساله.');
    await notifyNonprofit(params.id);
    await audit(staff,'nonprofits.retryEmail',{type:'nonprofit',id:params.id,label:'إعادة إشعار الإدارة'});
    return { saved:true };
  } },
};
