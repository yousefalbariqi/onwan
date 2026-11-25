import type { EventEntity } from '@paddle/paddle-node-sdk';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { activateSubscription } from './account.js';
import { getPageDataByUserId, savePageData } from './page.js';
import { purgePublicPage } from './publicCache.js';
import { requestRuntime } from './runtime.js';

export function paddleGrantsAccess(sub: {status:string; current_period_ends_at?:string|null} | null) {
  return Boolean(sub && ['active','trialing'].includes(sub.status)
    && (!sub.current_period_ends_at || new Date(sub.current_period_ends_at).getTime()>Date.now()));
}
export function validatePaddlePurchase(data:any,order:any) {
  const item=data.items?.[0];
  if (data.status!=='completed' || data.id!==order.transaction_id || data.items?.length!==1
    || item?.price?.id!==order.price_id || item.price.productId!==order.product_id || item.quantity!==1
    || item.price.billingCycle?.interval!=='year' || item.price.billingCycle.frequency!==1
    || item.price.trialPeriod || data.discountId || !data.subscriptionId || !data.customerId
    || !/^\d+$/.test(data.details?.totals?.grandTotal ?? '') || BigInt(data.details.totals.grandTotal)<=0n || !data.currencyCode
    || !data.billingPeriod?.startsAt || !data.billingPeriod?.endsAt) {
    throw new HttpError(409,'بيانات عملية Paddle لا تطابق طلب الاشتراك.');
  }
}

export async function processPaddleEvent(event:EventEntity) {
  const client=await pool.connect(); let orderId:string|undefined;
  try {
    await client.query('begin');
    const inserted=await client.query(`insert into paddle_webhook_events(event_id,event_type,occurred_at) values($1,$2,$3)
      on conflict(event_id) do nothing returning event_id`,[event.eventId,event.eventType,event.occurredAt]);
    if (!inserted.rowCount) { await client.query('commit'); return; }
    switch(event.eventType) {
      case 'customer.created': case 'customer.updated':
        await client.query(`insert into paddle_customers(customer_id,email,last_event_at) values($1,$2,$3)
          on conflict(customer_id) do update set email=excluded.email,last_event_at=excluded.last_event_at
          where paddle_customers.last_event_at<excluded.last_event_at`,[event.data.id,event.data.email,event.occurredAt]);
        break;
      case 'subscription.created': case 'subscription.updated': case 'subscription.canceled':
      case 'subscription.paused': case 'subscription.resumed': case 'subscription.activated': case 'subscription.past_due': {
        const sub=event.data;
        const mirrored=await client.query(`insert into paddle_subscriptions(subscription_id,customer_id,status,items,current_period_starts_at,current_period_ends_at,scheduled_change,last_event_at)
          values($1,$2,$3,$4::jsonb,$5,$6,$7::jsonb,$8) on conflict(subscription_id) do update set
          customer_id=excluded.customer_id,status=excluded.status,items=excluded.items,current_period_starts_at=excluded.current_period_starts_at,
          current_period_ends_at=excluded.current_period_ends_at,scheduled_change=excluded.scheduled_change,last_event_at=excluded.last_event_at
          where paddle_subscriptions.last_event_at<excluded.last_event_at returning subscription_id`,
          [sub.id,sub.customerId,sub.status,JSON.stringify(sub.items),sub.currentBillingPeriod?.startsAt ?? null,
            sub.currentBillingPeriod?.endsAt ?? null,JSON.stringify(sub.scheduledChange),event.occurredAt]);
        // A scheduled cancellation does not revoke access. Only update linked, already-paid app subscriptions.
        if(mirrored.rowCount) await client.query(`update subscriptions set status=$2,expires_at=coalesce($3,expires_at),updated_at=now()
          where paddle_subscription_id=$1`,[sub.id,paddleGrantsAccess({status:sub.status,current_period_ends_at:sub.currentBillingPeriod?.endsAt})?'active':'expired',sub.currentBillingPeriod?.endsAt ?? null]);
        break;
      }
      case 'transaction.completed': {
        const data=event.data;
        // customData is editable in a browser: it is not an authorization key.
        const order=(await client.query('select * from paddle_checkout_orders where transaction_id=$1 for update',[data.id])).rows[0];
        if(!order) break; // Unrelated sandbox transaction; never provision by matching email.
        validatePaddlePurchase(data,order);
        if(!order.paid_at) {
          await client.query(`update paddle_checkout_orders set status='paid',subscription_id=$2,customer_id=$3,amount_minor=$4,
            currency_code=$5,paid_at=$6,updated_at=now() where id=$1`,
            [order.id,data.subscriptionId,data.customerId,data.details.totals.grandTotal,data.currencyCode,event.occurredAt]);
          // Snapshot the paid period separately: subscription.created may arrive later.
          await client.query(`insert into paddle_subscriptions(subscription_id,customer_id,status,items,current_period_starts_at,current_period_ends_at,last_event_at)
            values($1,$2,'active',$3::jsonb,$4,$5,$6) on conflict(subscription_id) do nothing`,
            [data.subscriptionId,data.customerId,JSON.stringify(data.items),data.billingPeriod!.startsAt,data.billingPeriod!.endsAt,event.occurredAt]);
        }
        orderId=order.id;
        break;
      }
      default: break;
    }
    await client.query('commit');
  } catch(error) { await client.query('rollback'); throw error; } finally { client.release(); }
  // The paid record is durable first. A publication error must not lose payment or invite another charge.
  if(orderId) {
    const publish=()=>fulfillPaddleOrder(orderId!).catch(error=>console.error('[paddle] payment recorded; publication deferred',error instanceof HttpError?error.code ?? error.status:'internal'));
    const runtime=requestRuntime();
    if(runtime?.defer) runtime.defer(publish);
    else await publish();
  }
}

export async function fulfillPaddleOrder(id:string) {
  const client=await pool.connect(); let username:string|undefined;
  try {
    await client.query('begin');
    // Same lock order as checkout preparation: user, order, page.
    const ownerId=(await client.query('select user_id from paddle_checkout_orders where id=$1',[id])).rows[0]?.user_id;
    if(!ownerId) { await client.query('commit'); return; }
    const owner=(await client.query('select status,email_verified_at,account_kind from users where id=$1 for update',[ownerId])).rows[0];
    const order=(await client.query('select * from paddle_checkout_orders where id=$1 for update',[id])).rows[0];
    if(!order?.paid_at || order.fulfilled_at) { await client.query('commit'); return; }
    const sub=(await client.query('select * from paddle_subscriptions where subscription_id=$1 for update',[order.subscription_id])).rows[0];
    if(!paddleGrantsAccess(sub)) throw new HttpError(409,'الاشتراك غير متاح للتفعيل الآن.');
    const page=(await client.query('select status,draft_json,draft_saved_at from pages where user_id=$1 for update',[ownerId])).rows[0];
    const name=(await client.query('select username from customer_names where user_id=$1',[ownerId])).rows[0]?.username;
    if(owner?.status!=='active' || !owner.email_verified_at || owner.account_kind==='nonprofit' || !page || page.status==='suspended' || name!==order.username) throw new HttpError(409,'تحتاج الصفحة مراجعة قبل النشر.');
    await activateSubscription(ownerId,'annual',`PADDLE:sandbox:${order.transaction_id}`,client);
    await client.query(`update subscriptions set starts_at=$2,expires_at=$3,paddle_subscription_id=$4 where user_id=$1`,
      [ownerId,sub.current_period_starts_at,sub.current_period_ends_at,order.subscription_id]);
    await savePageData(ownerId,order.page_json,{client});
    // Publish the version accepted at checkout, retaining any edits made while waiting.
    const unchanged=String(page.draft_saved_at)===String(order.draft_saved_at);
    if(unchanged) await client.query('update pages set draft_json=null,draft_saved_at=null,draft_base_revision=null where user_id=$1',[ownerId]);
    else if(page.draft_json) await client.query('update pages set draft_json=$2::jsonb,draft_saved_at=$3,draft_base_revision=published_revision where user_id=$1',[ownerId,JSON.stringify(page.draft_json),page.draft_saved_at]);
    await client.query("update pages set status='published' where user_id=$1",[ownerId]);
    // Sandbox is deliberately not revenue in the existing SAR payment ledger.
    await client.query("update paddle_checkout_orders set status='published',fulfilled_at=now(),updated_at=now() where id=$1",[id]);
    username=(await getPageDataByUserId(ownerId,client))?.username;
    await client.query('commit');
  } catch(error) {
    await client.query('rollback');
    await pool.query("update paddle_checkout_orders set status='publication_failed',updated_at=now() where id=$1 and paid_at is not null and fulfilled_at is null",[id]);
    throw error;
  } finally { client.release(); }
  if(username) await purgePublicPage(username).catch(()=>undefined);
}

export async function retryPaddleFulfillment() {
  const orders=await pool.query("select id from paddle_checkout_orders where status in ('paid','publication_failed') order by updated_at limit 10");
  for(const order of orders.rows) await fulfillPaddleOrder(order.id).catch(()=>undefined);
}
