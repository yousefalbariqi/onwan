import { loadStorefront } from './partnerReferral.js';
import crypto from 'node:crypto';
import { getAccountSummary, isPlan, isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from './account.js';
import { createSessionToken, getBearerToken, verifySessionToken } from './auth.js';
import { pool } from './db.js';
import { DEMO_PARTNER_FLOORS, demoPricesOn } from './demoPrices.js';
import { OTP_RESEND_SECONDS, codeFailure, consumeCode, issueCode, resendWaitSeconds } from './otp.js';
import { assertNotLocked, clearFailures, recordFailure } from './loginGuard.js';
import { assertHuman } from './turnstile.js';
import { sendAdminEmail, sendNoticeEmail } from './email.js';
import { HttpError } from './http.js';
import { getPageDataByUserId, validatePartnerPageDraft } from './page.js';
import { hashPassword, validatePassword, verifyPassword } from './password.js';
import { PARTNER_ORDER_WINDOW_DAYS, getUsernameAvailability } from './username.js';

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
  sale_monthly: string | null;
  sale_annual: string | null;
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

// The partner's price for a plan; in test mode a missing one is filled (note 57).
function partnerFloor(partner: Partner, plan: 'monthly' | 'annual') {
  const set = toNumber(plan === 'annual' ? partner.price_annual : partner.price_monthly);
  return set ?? (demoPricesOn() ? DEMO_PARTNER_FLOORS[plan] : null);
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
    priceMonthly: partnerFloor(partner, 'monthly'),
    priceAnnual: partnerFloor(partner, 'annual'),
    testMode: demoPricesOn(),
    renewalRate: Number(partner.renewal_rate),
    saleMonthly: partner.sale_monthly == null ? null : Number(partner.sale_monthly),
    saleAnnual: partner.sale_annual == null ? null : Number(partner.sale_annual),
    slug: (partner as Partner & { slug?: string | null }).slug ?? null,
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

async function loadOwnAwaitingOrder(partner: Partner, orderId: unknown, allowDraft = false) {
  const result = await pool.query(
    `select id, order_number, customer_name, customer_email, payment_token,
            coalesce(sent_at, created_at) > now() - make_interval(days => $3) as in_window
     from partner_orders
     where id = $1 and partner_id = $2 and (status = 'awaiting_payment' or ($4 and status = 'draft'))`,
    [String(orderId ?? ''), partner.id, PARTNER_ORDER_WINDOW_DAYS, allowDraft],
  );

  const order = result.rows[0];

  if (!order) {
    throw new HttpError(404, 'الطلب غير موجود أو لم يعد بانتظار الدفع.');
  }

  return order;
}

// Owner decision (25 Oct 2026): a partner's «مع تصميم» costs the customer 39
// SAR, the same for every partner (it replaces the partner-set fee of note 61).
export const PARTNER_DESIGN_PRICE_SAR = 39;

// Note 62: the partner's acknowledgement, recorded word for word with the order.
export const PARTNER_ACK_TEXT = 'أقرّ بأنني أوضحت للعميل تفاصيل الخدمة وسعرها وشروط البيع، وأتحمل مسؤولية صحة المعلومات والالتزامات التي أقدمها له، مع الالتزام بسياسات منصة عنوان.';

// In test mode nothing is emailed: the link is shown to the partner instead,
// so a test order never reaches a real customer (note 57).
async function sendPaymentLinkEmail(order: { customer_email: string; customer_name: string }, shopName: string, link: string) {
  if (demoPricesOn()) return false;
  return sendNoticeEmail(order.customer_email, 'رابط إتمام اشتراكك في عنوان', [
    `مرحبًا ${order.customer_name}،`,
    `سجّل لك «${shopName}» صفحة في عنوان. لإتمام الاشتراك افتح الرابط التالي:`,
    link,
    'بعد إتمام الدفع يصلك رابط آمن لإنشاء كلمة مرورك، ويصبح الحساب ملكك وحدك.',
  ]);
}

const handlers: Record<string, Handler> = {
  'storefront.view': {
    access: 'public',
    run: async (params) => {
      const p = await loadStorefront(params.partnerId);
      return { partner: { id: p.id, shopName: p.shop_name, monthly: p.monthly, annual: p.annual } };
    },
  },
  'storefront.save': {
    access: 'partner',
    run: async (params, partner) => {
      requireActive(partner);
      const price = (value: unknown, floor: number | null) => {
        if (value === null || value === '') return null;
        const n = Number(value);
        if (floor === null || !Number.isFinite(n) || n < floor || n > 1000000) throw new HttpError(400, 'سعر البيع يجب ألا يقل عن الحد الذي حددته الإدارة.');
        return Math.round(n * 100) / 100;
      };
      const monthly = price(params.monthly, partnerFloor(partner, 'monthly'));
      const annual = price(params.annual, partnerFloor(partner, 'annual'));
      const updated = await pool.query<Partner>('update partners set sale_monthly = $2, sale_annual = $3, updated_at = now() where id = $1 returning *', [partner.id, monthly, annual]);
      return { partner: publicPartner(updated.rows[0]) };
    },
  },
  'orders.getDraft': {
    access: 'partner',
    run: async (params, partner) => {
      requireActive(partner);
      const result = await pool.query(`select id, page_json, customer_name, customer_email, username, plan, sale_price::float, partner_price::float, design_price::float, status, ready_at from partner_orders
        where id = $1 and partner_id = $2 and (status = 'draft' or (status = 'awaiting_payment'
        and coalesce(sent_at, created_at) > now() - make_interval(days => $3)))`, [String(params.id ?? ''), partner.id, PARTNER_ORDER_WINDOW_DAYS]);
      const order = result.rows[0];
      if (!order) throw new HttpError(404, 'الطلب غير متاح للتعديل.');
      return {
        pageData: { ...order.page_json, name: order.page_json?.name ?? order.customer_name, username: order.username },
        // For the review before sending (note 57).
        order: { status: order.status, ready: Boolean(order.ready_at), customerName: order.customer_name, customerEmail: order.customer_email, username: order.username, plan: order.plan, salePrice: order.sale_price, partnerPrice: order.partner_price, designPrice: order.design_price ?? 0 },
      };
    },
  },
  'orders.saveDraft': {
    access: 'partner',
    run: async (params, partner) => {
      requireActive(partner);
      const pageData = validatePartnerPageDraft(params.pageData, partner.id);
      // Note 64: a changed design needs the customer's approval again.
      const result = await pool.query(`update partner_orders set page_json = $3::jsonb, design_updated_at = now(), approved_at = null
        where id = $1 and partner_id = $2 and (status = 'draft' or (status = 'awaiting_payment'
        and coalesce(sent_at, created_at) > now() - make_interval(days => $4))) returning username`,
        [String(params.id ?? ''), partner.id, JSON.stringify(pageData), PARTNER_ORDER_WINDOW_DAYS]);
      if (!result.rows[0]) throw new HttpError(409, 'الطلب لم يعد متاحًا للتعديل.');
      return { pageData: { ...pageData, username: result.rows[0].username } };
    },
  },
  // B2B-01: partnership application; the account stays inactive until approved.
  apply: {
    access: 'public',
    run: async (params) => {
      const email = normalizeEmail(params.email);
      const phone = normalizePhone(params.phone);
      const shopName = text(params.shopName, 'الاسم مطلوب.');
      const contactName = text(params.contactName, 'اسم المسؤول مطلوب.', 2, 120);
      const city = String(params.city ?? '').trim().slice(0, 80) || null;

      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      if (!isValidPhone(phone)) throw new HttpError(400, 'رقم الجوال غير صالح.');

      // Note 54: no password at application. The account stays inactive until
      // approved; then the partner signs in with a code sent to this email.
      // '!' is not a valid hash, so no password can ever match it.
      try {
        await pool.query(
          `insert into partners (shop_name, contact_name, email, phone, city, password_hash)
           values ($1, $2, $3, $4, $5, '!')`,
          [shopName, contactName, email, phone, city],
        );
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new HttpError(409, 'يوجد طلب أو حساب شريك بهذا البريد.');
        }

        throw error;
      }

      await sendAdminEmail(`طلب شراكة جديد: ${shopName}`, [
        `الشريك: ${shopName}`,
        `المسؤول: ${contactName}`,
        `البريد: ${email}`,
        `الجوال: ${phone}`,
        `المدينة: ${city ?? '—'}`,
      ]);

      return { message: 'استلمنا طلب الشراكة. سيُفعَّل حسابك بعد موافقة إدارة عنوان.' };
    },
  },

  // Note 54: sign-in with a code sent to the partner's email (no password
  // needed). The answer is the same whether or not the email is known.
  'login.sendCode': {
    access: 'public',
    run: async (params) => {
      const email = normalizeEmail(params.email);
      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      const known = await pool.query("select 1 from partners where email = $1 and status in ('active', 'suspended', 'violation') limit 1", [email]);
      if (known.rowCount) await issueCode(email, 'partner_login', 'رمز الدخول إلى بوابة شركاء عنوان:');
      return { message: 'إن كان البريد لحساب شريك مفعّل، وصلك رمز الدخول الآن.' };
    },
  },

  'login.verifyCode': {
    access: 'public',
    run: async (params) => {
      const email = normalizeEmail(params.email);
      const result = await pool.query<Partner>("select * from partners where email = $1 and status <> 'deleted' limit 1", [email]);
      const partner = result.rows[0];
      if (!partner || !(await consumeCode(email, 'partner_login', String(params.code ?? '')))) {
        throw await codeFailure(email, 'partner_login');
      }
      if (partner.status === 'pending') throw new HttpError(403, 'طلب الشراكة قيد المراجعة. سيُفعَّل حسابك بعد موافقة الإدارة.');
      if (partner.status === 'rejected') throw new HttpError(403, 'لم يُقبل طلب الشراكة. تواصل مع إدارة عنوان.');
      return { token: createSessionToken(partner.id, partner.email, 'partner'), partner: publicPartner(partner) };
    },
  },

  login: {
    access: 'public',
    run: async (params) => {
      const tried = normalizeEmail(params.email);
      await assertNotLocked('partner', tried);
      const result = await pool.query<Partner & { password_hash: string }>(
        "select * from partners where email = $1 and status <> 'deleted' limit 1",
        [tried],
      );

      const partner = result.rows[0];

      if (!partner || !verifyPassword(String(params.password ?? ''), partner.password_hash)) {
        await recordFailure('partner', tried);
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
      await clearFailures('partner', tried);
      return { token: createSessionToken(partner.id, partner.email, 'partner'), partner: publicPartner(partner) };
    },
  },

  // The customer's side of the payment link.
  'order.view': {
    access: 'public',
    run: async (params) => {
      const result = await pool.query(
        `select o.order_number, o.customer_name, o.username, o.plan, o.sale_price::float, o.status, o.with_design, o.design_price::float,
                o.approved_at, o.revision_requested_at, p.phone as partner_phone,
                coalesce(o.sent_at, o.created_at) > now() - make_interval(days => $2) as in_window, o.page_json, p.shop_name
         from partner_orders o join partners p on p.id = o.partner_id
         where o.payment_token = $1`,
        [String(params.token ?? ''), PARTNER_ORDER_WINDOW_DAYS],
      );

      const order = result.rows[0];

      // A draft has not been offered yet: its link shows nothing (note 57).
      if (!order || order.status === 'cancelled' || order.status === 'draft') {
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
          withDesign: order.with_design,
          designPrice: order.design_price ?? 0,
          total: Number(order.sale_price) + Number(order.design_price ?? 0),
          approved: Boolean(order.approved_at),
          revisionRequested: Boolean(order.revision_requested_at),
          partnerPhone: order.partner_phone,
        },
        // SUB-02: only a gateway confirmation counts; the gateway is pending (P-08).
        paymentConfigured: false,
        testMode: demoPricesOn(),
        pageData: order.status === 'awaiting_payment' && order.in_window ? { ...order.page_json, username: order.username } : null,
      };
    },
  },

  // Note 64: the customer approves the design they saw (not a purchase).
  'order.approve': {
    access: 'public',
    run: async (params) => {
      const result = await pool.query(
        `update partner_orders set approved_at = now(), revision_requested_at = null
         where payment_token = $1 and status = 'awaiting_payment'
           and coalesce(sent_at, created_at) > now() - make_interval(days => $2)
         returning id`,
        [String(params.token ?? ''), PARTNER_ORDER_WINDOW_DAYS],
      );
      if (!result.rowCount) throw new HttpError(404, 'الطلب غير متاح.');
      return { ok: true };
    },
  },

  // Note 64: the customer asks the partner for changes, with a short note.
  'order.requestChanges': {
    access: 'public',
    run: async (params) => {
      const note = String(params.note ?? '').trim().slice(0, 1000);
      if (note.length < 3) throw new HttpError(400, 'اكتب ما تريد تعديله.');
      const result = await pool.query(
        `update partner_orders o set revision_requested_at = now(), revision_note = $3, approved_at = null
         from partners p
         where o.payment_token = $1 and o.status = 'awaiting_payment' and p.id = o.partner_id
           and coalesce(o.sent_at, o.created_at) > now() - make_interval(days => $2)
         returning o.order_number, o.customer_name, p.email as partner_email`,
        [String(params.token ?? ''), PARTNER_ORDER_WINDOW_DAYS, note],
      );
      const order = result.rows[0];
      if (!order) throw new HttpError(404, 'الطلب غير متاح.');
      if (!demoPricesOn()) {
        await sendNoticeEmail(order.partner_email, `طلب تعديل على الطلب #${order.order_number}`, [
          `طلب العميل «${order.customer_name}» تعديلًا على التصميم:`,
          note,
          'افتح الطلب من بوابة الشركاء، عدّل التصميم، ثم أعد إرساله.',
        ]);
      }
      return { ok: true };
    },
  },

  // Note 57, test mode only (DEMO_PRICES): the customer completes a test
  // payment that runs exactly what the employee's confirmation runs — account,
  // page, subscription and the partner's profit — with nothing charged and
  // nothing emailed. The set-password link is returned to open the editor.
  'order.testPay': {
    access: 'public',
    run: async (params, _partner, context) => {
      if (!demoPricesOn()) throw new HttpError(403, 'الدفع التجريبي غير متاح.');
      // Note 62: the customer accepts the terms themself before paying.
      if (params.termsAccepted !== true) throw new HttpError(400, 'وافق على الشروط أولًا.');
      const result = await pool.query(
        `select id from partner_orders where payment_token = $1 and status = 'awaiting_payment'
         and coalesce(sent_at, created_at) > now() - make_interval(days => $2)
         and (not with_design or approved_at is not null)`,
        [String(params.token ?? ''), PARTNER_ORDER_WINDOW_DAYS],
      );
      if (!result.rows[0]) throw new HttpError(409, 'وافق على التصميم أولًا، أو الطلب غير متاح للدفع.');
      await pool.query('update partner_orders set customer_terms_at = now() where id = $1', [result.rows[0].id]);
      const { completePartnerOrder } = await import('./adminPartners.js');
      const { setupLink } = await completePartnerOrder(result.rows[0].id, 'دفع تجريبي', 'وضع الاختبار', context.origin);
      return { setupLink };
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

  // Note 73: right after paying, the customer finishes on the same page. A
  // code goes to the account's email — paying alone does not prove owning
  // that email — and proving it also confirms the email once (note 70).
  'welcome.sendCode': {
    access: 'public',
    run: async (params) => {
      const result = await pool.query<{ email: string }>(
        `select u.email from account_setup_tokens t join users u on u.id = t.user_id
         where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
        [hashSetupToken(String(params.token ?? ''))],
      );
      const email = result.rows[0]?.email;
      if (!email) throw new HttpError(404, 'انتهت صلاحية هذا الرابط أو استُخدم من قبل.');
      const wait = await resendWaitSeconds(email, 'verify_email');
      if (!wait) await issueCode(email, 'verify_email', 'رمز تأكيد بريدك وإنشاء حسابك في عنوان:');
      const [name, domain] = email.split('@');
      return { email: `${name.slice(0, 2)}•••@${domain}`, retryAfter: wait || OTP_RESEND_SECONDS };
    },
  },

  'welcome.complete': {
    access: 'public',
    run: async (params) => {
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);
      if (passwordError) throw new HttpError(400, passwordError);
      const tokenHash = hashSetupToken(String(params.token ?? ''));
      const found = await pool.query<{ user_id: string; email: string }>(
        `select t.user_id, u.email from account_setup_tokens t join users u on u.id = t.user_id
         where t.token_hash = $1 and t.used_at is null and t.expires_at > now()`,
        [tokenHash],
      );
      const row = found.rows[0];
      if (!row) throw new HttpError(404, 'انتهت صلاحية هذا الرابط أو استُخدم من قبل.');
      if (!(await consumeCode(row.email, 'verify_email', String(params.code ?? '')))) throw await codeFailure(row.email, 'verify_email');
      const used = await pool.query('update account_setup_tokens set used_at = now() where token_hash = $1 and used_at is null returning 1', [tokenHash]);
      if (!used.rowCount) throw new HttpError(409, 'استُخدم هذا الرابط للتو. سجّل الدخول.');
      const updatedUser = await pool.query<{ session_version: number }>('update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = $1 returning session_version', [row.user_id, hashPassword(password)]);
      return {
        token: createSessionToken(row.user_id, row.email, undefined, updatedUser.rows[0].session_version),
        pageData: await getPageDataByUserId(row.user_id),
        account: await getAccountSummary(row.user_id),
      };
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

      const user = await pool.query<{ email: string; session_version: number }>(
        'update users set password_hash = $2, updated_at = now() where id = $1 returning email, session_version',
        [userId, hashPassword(password)],
      );

      return {
        token: createSessionToken(userId, user.rows[0].email, undefined, user.rows[0].session_version),
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
                sale_price::float, payment_token, created_at, link_sent_at, with_design,
                approved_at, revision_requested_at, revision_note
         from partner_orders
         where partner_id = $1 and status = 'awaiting_payment'
           and coalesce(sent_at, created_at) > now() - make_interval(days => $2)
         order by created_at desc`,
        [partner.id, PARTNER_ORDER_WINDOW_DAYS],
      );

      // Note 57: orders still being designed, and those cancelled lately.
      const drafts = await pool.query(
        `select id, order_number, customer_name, username, plan, sale_price::float, with_design, ready_at, created_at
         from partner_orders where partner_id = $1 and status = 'draft' order by created_at desc`,
        [partner.id],
      );
      const cancelled = await pool.query(
        `select order_number, customer_name, plan, cancelled_at from partner_orders
         where partner_id = $1 and status = 'cancelled' and cancelled_at > now() - interval '30 days'
         order by cancelled_at desc limit 50`,
        [partner.id],
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
        drafts: drafts.rows,
        cancelled: cancelled.rows,
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

      const partnerPrice = partnerFloor(partner, params.plan);

      if (partnerPrice === null) {
        throw new HttpError(409, 'لم تحدد إدارة عنوان سعرك لهذا الاشتراك بعد. تواصل مع الإدارة.');
      }

      // Note 65: the price comes from «إعدادات التسعير», the one source for
      // every channel; the order keeps it even if the setting changes later.
      const saved = params.plan === 'annual' ? partner.sale_annual : partner.sale_monthly;
      const salePrice = saved != null ? Number(saved) : demoPricesOn() ? partnerPrice : NaN;

      if (!Number.isFinite(salePrice)) {
        throw new HttpError(409, 'حدد سعر هذا الاشتراك في «إعدادات التسعير» أولًا.');
      }

      if (salePrice < partnerPrice || salePrice > 1000000) {
        throw new HttpError(400, `سعر البيع في «إعدادات التسعير» يجب ألا يقل عن ${partnerPrice} ريال.`);
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
         where (status = 'draft' or (status = 'awaiting_payment' and coalesce(sent_at, created_at) > now() - make_interval(days => $3)))
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

      const pageJson = validatePartnerPageDraft(params.pageData ?? {
        name: customerName, bio: params.bio, theme: params.theme,
      }, partner.id);
      const token = crypto.randomBytes(24).toString('base64url');

      const draft = params.draft === true;
      // Note 61: the partner sets the design fee (0 = free); only with design.
      // Owner decision (25 Oct 2026): the design fee is fixed, not set by the partner.
      const designPrice = draft ? PARTNER_DESIGN_PRICE_SAR : 0;
      const result = await pool.query(
        `insert into partner_orders
           (partner_id, customer_name, customer_phone, customer_email, username, plan, sale_price, partner_price,
            page_json, terms_accepted_at, payment_token, status, with_design, sent_at, link_sent_at, design_price, partner_ack_text)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now(), $10, $11, $12, $13, $13, $14, $15)
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
          draft ? 'draft' : 'awaiting_payment',
          draft,
          draft ? null : new Date(),
          designPrice,
          PARTNER_ACK_TEXT,
        ],
      ).catch((error: any) => {
        // The draft columns come with database/phase16-partner-order-drafts.sql.
        if (error?.code === '42703' || error?.code === '23514') throw new HttpError(503, 'يلزم تشغيل ملف قاعدة البيانات phase16-partner-order-drafts.sql لتفعيل «بيع جديد».');
        throw error;
      });

      // A design draft is not sent yet; the partner opens it in the editor.
      if (draft) return { id: result.rows[0].id, orderNumber: result.rows[0].order_number, draft: true };

      const link = payLink(context.origin, token);
      const emailed = await sendPaymentLinkEmail(
        { customer_email: customerEmail, customer_name: customerName },
        partner.shop_name,
        link,
      );

      return { orderNumber: result.rows[0].order_number, payLink: link, emailed };
    },
  },

  // Note 57: «بيع جديد» in one step. Without design the order is created and
  // sent at once (the customer designs the page after paying). With design
  // it starts as a draft the partner shapes in the editor; nothing reaches the
  // customer until «إرسال العرض». Only a preview-and-buy link is ever sent.
  'orders.start': {
    access: 'partner',
    run: async (params, partner, context) => {
      requireActive(partner);
      const withDesign = params.withDesign === true;
      const response = (await handlers['orders.create'].run({ ...params, draft: withDesign, pageData: params.pageData ?? { name: params.customerName } }, partner, context)) as Record<string, unknown>;
      return { ...response, withDesign };
    },
  },

  // The partner finished designing; the order waits for review and sending.
  'orders.markReady': {
    access: 'partner',
    run: async (params, partner) => {
      requireActive(partner);
      const result = await pool.query("update partner_orders set ready_at = coalesce(ready_at, now()) where id = $1 and partner_id = $2 and status = 'draft' returning id", [String(params.id ?? ''), partner.id]);
      if (!result.rowCount) throw new HttpError(404, 'الطلب غير موجود أو أُرسل بالفعل.');
      return { ok: true };
    },
  },

  // Sends a draft: the name is checked again, the window starts now.
  'orders.send': {
    access: 'partner',
    run: async (params, partner, context) => {
      requireActive(partner);
      const result = await pool.query(
        "select id, order_number, customer_name, customer_email, username, payment_token from partner_orders where id = $1 and partner_id = $2 and status = 'draft'",
        [String(params.id ?? ''), partner.id],
      );
      const order = result.rows[0];
      if (!order) throw new HttpError(404, 'الطلب غير موجود أو أُرسل بالفعل.');
      const availability = await getUsernameAvailability(order.username, { ignoreOrderId: order.id });
      if (!availability.available) throw new HttpError(409, `اسم الرابط «${order.username}» لم يعد متاحًا. أنشئ طلبًا جديدًا باسم آخر.`);
      await pool.query("update partner_orders set status = 'awaiting_payment', ready_at = coalesce(ready_at, now()), sent_at = now(), link_sent_at = now() where id = $1", [order.id]);
      const link = payLink(context.origin, order.payment_token);
      const emailed = await sendPaymentLinkEmail(order, partner.shop_name, link);
      return { orderNumber: order.order_number, payLink: link, emailed };
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

      // A resend after changes answers the customer's request (note 64).
      await pool.query('update partner_orders set link_sent_at = now(), revision_requested_at = null where id = $1', [order.id]);

      return { payLink: link, emailed };
    },
  },

  // B2B-07: cancel before payment, no reason needed; the administration is
  // told and keeps the record.
  'orders.cancel': {
    access: 'partner',
    run: async (params, partner) => {
      // A draft can be cancelled too (note 57).
      const order = await loadOwnAwaitingOrder(partner, params.id, true);

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
  // REQ-020: public entry points a robot would hammer.
  if (['apply', 'login', 'login.sendCode'].includes(action)) await assertHuman(req, params);

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
