import crypto from 'crypto';
import { getAccountSummary, isPlan, isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from './account';
import { createSessionToken, getBearerToken, verifySessionToken } from './auth';
import { pool } from './db';
import { sendAdminEmail, sendNoticeEmail } from './email';
import { HttpError } from './http';
import { getPageDataByUserId } from './page';
import { hashPassword, validatePassword, verifyPassword } from './password';
import { PARTNER_ORDER_WINDOW_DAYS, getUsernameAvailability } from './username';

export type Partner = {
  id: string;
  shop_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string | null;
  status: 'pending' | 'active' | 'suspended' | 'violation' | 'rejected' | 'deleted';
  status_reason: string | null;
  price_monthly: string | null;
  price_annual: string | null;
  renewal_rate: string;
};

type Context = { origin: string };

type Handler = {
  access: 'public' | 'partner';
  run: (params: any, partner: Partner, context: Context) => Promise<unknown>;
};

const SETUP_LINK_DAYS = 7;

function text(value: unknown, message: string, min = 2, max = 160) {
  const result = String(value ?? '').trim();

  if (result.length < min || result.length > max) {
    throw new HttpError(400, message);
  }

  return result;
}

function toNumber(value: string | null) {
  return value === null ? null : Number(value);
}

function publicPartner(partner: Partner) {
  return {
    id: partner.id,
    shopName: partner.shop_name,
    contactName: partner.contact_name,
    email: partner.email,
    phone: partner.phone,
    city: partner.city ?? '',
    status: partner.status,
    priceMonthly: toNumber(partner.price_monthly),
    priceAnnual: toNumber(partner.price_annual),
    renewalRate: Number(partner.renewal_rate),
  };
}

export function payLink(origin: string, token: string) {
  return `${origin}/pay/${token}`;
}

export function hashSetupToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// B2B-05: one-time link from which the customer creates their own password.
export async function createSetupLink(userId: string, origin: string, queryable: { query: typeof pool.query } = pool) {
  const token = crypto.randomBytes(32).toString('base64url');

  await queryable.query(
    `insert into account_setup_tokens (token_hash, user_id, expires_at)
     values ($1, $2, now() + make_interval(days => $3))`,
    [hashSetupToken(token), userId, SETUP_LINK_DAYS],
  );

  return `${origin}/welcome/${token}`;
}

// B2B-13: customers, due, paid and remaining. The optional period filters what
// was earned and paid inside it; «remaining» is always the all-time balance.
export async function getPartnerTotals(partnerId: string, from?: string | null, to?: string | null) {
  const range = [partnerId, from || null, to || null];

  const result = await pool.query(
    `
      select
        (select count(*)::int from partner_orders
          where partner_id = $1 and status = 'completed'
            and ($2::timestamptz is null or completed_at >= $2) and ($3::timestamptz is null or completed_at < $3)) as customers,
        (select coalesce(sum(amount), 0)::float from partner_commissions
          where partner_id = $1
            and ($2::timestamptz is null or created_at >= $2) and ($3::timestamptz is null or created_at < $3)) as earned,
        (select coalesce(sum(amount), 0)::float from partner_payouts
          where partner_id = $1
            and ($2::timestamptz is null or paid_at >= $2) and ($3::timestamptz is null or paid_at < $3)) as paid,
        (select coalesce(sum(renewals_count), 0)::int from partner_payouts
          where partner_id = $1
            and ($2::timestamptz is null or paid_at >= $2) and ($3::timestamptz is null or paid_at < $3)) as renewals_paid,
        (select count(*)::int from partner_commissions
          where partner_id = $1 and kind = 'renewal' and amount is null) as renewals_unpriced,
        (select coalesce(sum(amount), 0)::float from partner_commissions where partner_id = $1)
          - (select coalesce(sum(amount), 0)::float from partner_payouts where partner_id = $1) as remaining,
        (select max(paid_at) from partner_payouts where partner_id = $1) as last_payout_at
    `,
    range,
  );

  const row = result.rows[0];

  return {
    customers: row.customers,
    earned: row.earned,
    paid: row.paid,
    remaining: row.remaining,
    renewalsPaid: row.renewals_paid,
    renewalsUnpriced: row.renewals_unpriced,
    lastPayoutAt: row.last_payout_at,
  };
}

function parseDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function requireActive(partner: Partner) {
  if (partner.status !== 'active') {
    throw new HttpError(403, 'حساب الشريك موقوف؛ لا يمكن تسجيل عملاء جدد أو تعديل الطلبات.');
  }
}

async function loadOwnAwaitingOrder(partner: Partner, orderId: unknown) {
  const result = await pool.query(
    `select id, order_number, customer_name, customer_email, payment_token,
            created_at > now() - make_interval(days => $3) as in_window
     from partner_orders
     where id = $1 and partner_id = $2 and status = 'awaiting_payment'`,
    [String(orderId ?? ''), partner.id, PARTNER_ORDER_WINDOW_DAYS],
  );

  const order = result.rows[0];

  if (!order) {
    throw new HttpError(404, 'الطلب غير موجود أو لم يعد بانتظار الدفع.');
  }

  return order;
}

function sendPaymentLinkEmail(order: { customer_email: string; customer_name: string }, shopName: string, link: string) {
  return sendNoticeEmail(order.customer_email, 'رابط إتمام اشتراكك في عنوان', [
    `مرحبًا ${order.customer_name}،`,
    `سجّل لك «${shopName}» صفحة في عنوان. لإتمام الاشتراك افتح الرابط التالي:`,
    link,
    'بعد إتمام الدفع يصلك رابط آمن لإنشاء كلمة مرورك، ويصبح الحساب ملكك وحدك.',
  ]);
}

const handlers: Record<string, Handler> = {
  // B2B-01: partnership application; the account stays inactive until approved.
  apply: {
    access: 'public',
    run: async (params) => {
      const email = normalizeEmail(params.email);
      const phone = normalizePhone(params.phone);
      const shopName = text(params.shopName, 'اسم المحل مطلوب.');
      const contactName = text(params.contactName, 'اسم المسؤول مطلوب.', 2, 120);
      const city = String(params.city ?? '').trim().slice(0, 80) || null;
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);

      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      if (!isValidPhone(phone)) throw new HttpError(400, 'رقم الجوال غير صالح.');
      if (passwordError) throw new HttpError(400, passwordError);

      try {
        await pool.query(
          `insert into partners (shop_name, contact_name, email, phone, city, password_hash)
           values ($1, $2, $3, $4, $5, $6)`,
          [shopName, contactName, email, phone, city, hashPassword(password)],
        );
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new HttpError(409, 'يوجد طلب أو حساب شريك بهذا البريد.');
        }

        throw error;
      }

      await sendAdminEmail(`طلب شراكة جديد: ${shopName}`, [
        `المحل: ${shopName}`,
        `المسؤول: ${contactName}`,
        `البريد: ${email}`,
        `الجوال: ${phone}`,
        `المدينة: ${city ?? '—'}`,
      ]);

      return { message: 'استلمنا طلب الشراكة. سيُفعَّل حسابك بعد موافقة إدارة عنوان.' };
    },
  },

  login: {
    access: 'public',
    run: async (params) => {
      const result = await pool.query<Partner & { password_hash: string }>(
        "select * from partners where email = $1 and status <> 'deleted' limit 1",
        [normalizeEmail(params.email)],
      );

      const partner = result.rows[0];

      if (!partner || !verifyPassword(String(params.password ?? ''), partner.password_hash)) {
        throw new HttpError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }

      // AC-11: no entry before the administration approves.
      if (partner.status === 'pending') {
        throw new HttpError(403, 'طلب الشراكة قيد المراجعة. سيُفعَّل حسابك بعد موافقة الإدارة.');
      }

      if (partner.status === 'rejected') {
        throw new HttpError(403, 'لم يُقبل طلب الشراكة. تواصل مع إدارة عنوان.');
      }

      // A stopped partner still signs in to see their records and commissions.
      return { token: createSessionToken(partner.id, partner.email, 'partner'), partner: publicPartner(partner) };
    },
  },

  // The customer's side of the payment link.
  'order.view': {
    access: 'public',
    run: async (params) => {
      const result = await pool.query(
        `select o.order_number, o.customer_name, o.username, o.plan, o.sale_price::float, o.status,
                o.created_at > now() - make_interval(days => $2) as in_window, p.shop_name
         from partner_orders o join partners p on p.id = o.partner_id
         where o.payment_token = $1`,
        [String(params.token ?? ''), PARTNER_ORDER_WINDOW_DAYS],
      );

      const order = result.rows[0];

      if (!order || order.status === 'cancelled') {
        throw new HttpError(404, 'هذا الرابط غير صالح أو أُلغي الطلب.');
      }

      return {
        order: {
          orderNumber: order.order_number,
          customerName: order.customer_name,
          username: order.username,
          plan: order.plan,
          price: order.sale_price,
          status: order.status,
          shopName: order.shop_name,
        },
        // SUB-02: only a gateway confirmation counts; the gateway is pending (P-08).
        paymentConfigured: false,
      };
    },
  },

  'welcome.view': {
    access: 'public',
    run: async (params) => {
      const result = await pool.query(
        `select u.email, un.username
         from account_setup_tokens t
         join users u on u.id = t.user_id
         left join customer_names un on un.user_id = u.id
         where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
        [hashSetupToken(String(params.token ?? ''))],
      );

      if (!result.rows[0]) {
        throw new HttpError(404, 'انتهت صلاحية هذا الرابط أو استُخدم من قبل. استخدم «نسيت كلمة المرور» في صفحة الدخول.');
      }

      return result.rows[0];
    },
  },

  // B2B-05: the customer creates the password; the partner never has it.
  'welcome.setPassword': {
    access: 'public',
    run: async (params) => {
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);

      if (passwordError) throw new HttpError(400, passwordError);

      const result = await pool.query<{ user_id: string }>(
        `update account_setup_tokens set used_at = now()
         where token_hash = $1 and used_at is null and expires_at > now()
         returning user_id`,
        [hashSetupToken(String(params.token ?? ''))],
      );

      const userId = result.rows[0]?.user_id;

      if (!userId) {
        throw new HttpError(404, 'انتهت صلاحية هذا الرابط أو استُخدم من قبل. استخدم «نسيت كلمة المرور» في صفحة الدخول.');
      }

      const user = await pool.query<{ email: string }>(
        'update users set password_hash = $2, updated_at = now() where id = $1 returning email',
        [userId, hashPassword(password)],
      );

      return {
        token: createSessionToken(userId, user.rows[0].email),
        pageData: await getPageDataByUserId(userId),
        account: await getAccountSummary(userId),
      };
    },
  },

  me: { access: 'partner', run: async (_params, partner) => ({ partner: publicPartner(partner) }) },

  summary: {
    access: 'partner',
    run: async (params, partner) => {
      const payouts = await pool.query(
        `select amount::float, renewals_count, note, paid_at from partner_payouts
         where partner_id = $1 order by paid_at desc limit 50`,
        [partner.id],
      );

      return {
        totals: await getPartnerTotals(partner.id, parseDate(params.from), parseDate(params.to)),
        payouts: payouts.rows,
      };
    },
  },

  'orders.list': {
    access: 'partner',
    run: async (_params, partner, context) => {
      // B2B-06: an unpaid order leaves the partner's view after the window
      // (it stays with the administration).
      const awaiting = await pool.query(
        `select id, order_number, customer_name, customer_phone, customer_email, username, plan,
                sale_price::float, payment_token, created_at, link_sent_at
         from partner_orders
         where partner_id = $1 and status = 'awaiting_payment'
           and created_at > now() - make_interval(days => $2)
         order by created_at desc`,
        [partner.id, PARTNER_ORDER_WINDOW_DAYS],
      );

      // B2B-09: after completion only the name, the order number and the
      // commission — no contact details, no account.
      const completed = await pool.query(
        `select o.order_number, o.customer_name, o.plan, o.completed_at,
                (select coalesce(sum(c.amount), 0)::float from partner_commissions c where c.order_id = o.id) as commission,
                (select count(*)::int from partner_commissions c where c.order_id = o.id and c.kind = 'renewal') as renewals
         from partner_orders o
         where o.partner_id = $1 and o.status = 'completed'
         order by o.completed_at desc
         limit 300`,
        [partner.id],
      );

      return {
        awaiting: awaiting.rows.map(({ payment_token, ...order }) => ({
          ...order,
          payLink: payLink(context.origin, payment_token),
        })),
        completed: completed.rows,
        windowDays: PARTNER_ORDER_WINDOW_DAYS,
      };
    },
  },

  // B2B-03/04/10: register a customer and send them the payment link.
  'orders.create': {
    access: 'partner',
    run: async (params, partner, context) => {
      requireActive(partner);

      if (!isPlan(params.plan)) {
        throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
      }

      const partnerPrice = toNumber(params.plan === 'annual' ? partner.price_annual : partner.price_monthly);

      if (partnerPrice === null) {
        throw new HttpError(409, 'لم تحدد إدارة عنوان سعرك لهذا الاشتراك بعد. تواصل مع الإدارة.');
      }

      const salePrice = Math.round(Number(params.salePrice) * 100) / 100;

      if (!Number.isFinite(salePrice) || salePrice < partnerPrice || salePrice > 1000000) {
        throw new HttpError(400, `سعر البيع يجب ألا يقل عن ${partnerPrice} ريال.`);
      }

      // B2B-04: the partner records the customer's agreement to the terms.
      if (params.termsAccepted !== true) {
        throw new HttpError(400, 'يجب تسجيل موافقة العميل على الشروط.');
      }

      const customerName = text(params.customerName, 'اسم الجهة مطلوب.');
      const customerEmail = normalizeEmail(params.customerEmail);
      const customerPhone = normalizePhone(params.customerPhone);

      if (!isValidEmail(customerEmail)) throw new HttpError(400, 'بريد العميل غير صالح.');
      if (!isValidPhone(customerPhone)) throw new HttpError(400, 'جوال العميل غير صالح.');

      const existing = await pool.query('select 1 from users where email = $1 or phone = $2 limit 1', [
        customerEmail,
        customerPhone,
      ]);

      if (existing.rowCount) {
        throw new HttpError(409, 'يوجد حساب في عنوان بهذا البريد أو رقم الجوال.');
      }

      // The same customer cannot sit in two open orders at once.
      const openOrder = await pool.query(
        `select 1 from partner_orders
         where status = 'awaiting_payment' and created_at > now() - make_interval(days => $3)
           and (customer_email = $1 or customer_phone = $2)
         limit 1`,
        [customerEmail, customerPhone, PARTNER_ORDER_WINDOW_DAYS],
      );

      if (openOrder.rowCount) {
        throw new HttpError(409, 'يوجد طلب مفتوح بانتظار الدفع لهذا العميل. ألغِه أولًا لإنشاء طلب جديد.');
      }

      const availability = await getUsernameAvailability(String(params.username ?? ''));

      if (!availability.available) {
        throw new HttpError(409, availability.reason ?? 'الاسم غير متاح.');
      }

      const theme = params.theme ?? {};
      const isColor = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value));
      const pageJson = {
        name: customerName,
        bio: String(params.bio ?? '').trim().slice(0, 150),
        theme: ['background', 'buttonColor', 'buttonTextColor', 'textColor'].every((key) => isColor(theme[key]))
          ? {
              id: String(theme.id ?? 'custom').slice(0, 30),
              name: String(theme.name ?? '').slice(0, 30),
              background: theme.background,
              buttonColor: theme.buttonColor,
              buttonTextColor: theme.buttonTextColor,
              textColor: theme.textColor,
            }
          : null,
      };

      const token = crypto.randomBytes(24).toString('base64url');

      const result = await pool.query(
        `insert into partner_orders
           (partner_id, customer_name, customer_phone, customer_email, username, plan, sale_price, partner_price,
            page_json, terms_accepted_at, payment_token)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), $10)
         returning id, order_number`,
        [
          partner.id,
          customerName,
          customerPhone,
          customerEmail,
          availability.normalized,
          params.plan,
          salePrice,
          partnerPrice,
          JSON.stringify(pageJson),
          token,
        ],
      );

      const link = payLink(context.origin, token);
      const emailed = await sendPaymentLinkEmail(
        { customer_email: customerEmail, customer_name: customerName },
        partner.shop_name,
        link,
      );

      return { orderNumber: result.rows[0].order_number, payLink: link, emailed };
    },
  },

  // B2B-06: resend within the payment window only.
  'orders.resend': {
    access: 'partner',
    run: async (params, partner, context) => {
      requireActive(partner);
      const order = await loadOwnAwaitingOrder(partner, params.id);

      if (!order.in_window) {
        throw new HttpError(409, `انتهت مهلة إعادة الإرسال (${PARTNER_ORDER_WINDOW_DAYS} أيام). أنشئ طلبًا جديدًا.`);
      }

      const link = payLink(context.origin, order.payment_token);
      const emailed = await sendPaymentLinkEmail(order, partner.shop_name, link);

      await pool.query('update partner_orders set link_sent_at = now() where id = $1', [order.id]);

      return { payLink: link, emailed };
    },
  },

  // B2B-07: cancel before payment, no reason needed; the administration is
  // told and keeps the record.
  'orders.cancel': {
    access: 'partner',
    run: async (params, partner) => {
      const order = await loadOwnAwaitingOrder(partner, params.id);

      await pool.query("update partner_orders set status = 'cancelled', cancelled_at = now() where id = $1", [order.id]);

      await sendAdminEmail(`إلغاء طلب شريك #${order.order_number}`, [
        `الشريك: ${partner.shop_name}`,
        `العميل: ${order.customer_name}`,
        'ألغى الشريك الطلب قبل الدفع.',
      ]);

      return { ok: true };
    },
  },
};

export async function runPartnerAction(req: any, action: string, params: any, origin: string) {
  const handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;

  if (!handler) {
    throw new HttpError(400, 'إجراء غير معروف.');
  }

  if (handler.access === 'public') {
    return handler.run(params, null as unknown as Partner, { origin });
  }

  const session = verifySessionToken(getBearerToken(req));

  if (!session || session.kind !== 'partner') {
    throw new HttpError(401, 'انتهت الجلسة. سجّل الدخول من جديد.');
  }

  // Loaded on every request so a status change applies to live sessions.
  const result = await pool.query<Partner>('select * from partners where id = $1 limit 1', [session.userId]);
  const partner = result.rows[0];

  if (!partner || ['pending', 'rejected', 'deleted'].includes(partner.status)) {
    throw new HttpError(401, 'انتهت الجلسة. سجّل الدخول من جديد.');
  }

  return handler.run(params, partner, { origin });
}
