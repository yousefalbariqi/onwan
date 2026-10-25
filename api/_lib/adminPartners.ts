import { activateSubscription, isValidEmail, isValidPhone, normalizeEmail, normalizePhone } from './account.js';
import type { Handler, Staff } from './admin.js';
import { audit, requireText } from './admin.js';
import { pool } from './db.js';
import { sendNoticeEmail } from './email.js';
import { HttpError } from './http.js';
import { ensurePageForUser, savePageData } from './page.js';
import { createSetupLink, getPartnerTotals } from './partner.js';
import { hashPassword, validatePassword } from './password.js';
import { recordPayment } from './services.js';
import { getUsernameAvailability } from './username.js';

// B2B-12: renewal commission is owed for the first three years.
const RENEWAL_COMMISSION_YEARS = 3;

type PartnerRow = { id: string; shop_name: string; status: string };

async function loadPartner(id: unknown): Promise<PartnerRow> {
  const result = await pool.query<PartnerRow>('select id, shop_name, status from partners where id = $1', [
    String(id ?? ''),
  ]);

  if (!result.rows[0]) {
    throw new HttpError(404, 'الشريك غير موجود.');
  }

  return result.rows[0];
}

function partnerTarget(partner: PartnerRow) {
  return { type: 'partner', id: partner.id, label: partner.shop_name };
}

async function setStatus(staff: Staff, partner: PartnerRow, status: string, action: string, reason: string | null = null) {
  await pool.query('update partners set status = $2, status_reason = $3, updated_at = now() where id = $1', [
    partner.id,
    status,
    reason,
  ]);

  await audit(staff, action, partnerTarget(partner), reason ? { reason } : {});
  return { ok: true };
}

function parsePrice(value: unknown) {
  if (value === null || value === '' || value === undefined) return null;

  const price = Math.round(Number(value) * 100) / 100;

  if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
    throw new HttpError(400, 'أدخل سعرًا صحيحًا بالريال.');
  }

  return price;
}

// Called when the administration renews a customer's subscription. Records the
// renewal for the partner who brought the customer, inside the three-year
// window, unless the partner was stopped for a violation (B2B-15). The amount
// stays empty: the base of the percentage is a pending decision (P-04).
export async function recordPartnerRenewal(userId: string) {
  const result = await pool.query(
    `
      insert into partner_commissions (partner_id, order_id, kind, rate)
      select p.id, o.id, 'renewal', p.renewal_rate
      from partner_orders o
      join partners p on p.id = o.partner_id
      where o.user_id = $1 and o.status = 'completed'
        and o.completed_at > now() - make_interval(years => $2)
        and p.status not in ('violation', 'deleted')
      limit 1
    `,
    [userId, RENEWAL_COMMISSION_YEARS],
  );

  return Boolean(result.rowCount);
}

// The whole of a partner order's payment: the customer's account is born,
// the page published, the subscription started, the partner's profit
// recorded. Used by the employee's confirmation, and by the test payment
// (note 57) when DEMO_PRICES is on.
export async function completePartnerOrder(orderId: string, reference: string, recordedBy: string, origin: string) {
    const client = await pool.connect();

    try {
      await client.query('begin');

      const orderResult = await client.query(
        `select o.*, p.shop_name, p.status as partner_status
         from partner_orders o join partners p on p.id = o.partner_id
         where o.id = $1 for update of o`,
        [orderId],
      );

      const order = orderResult.rows[0];

      if (!order || order.status !== 'awaiting_payment') {
        throw new HttpError(409, 'الطلب غير موجود أو ليس بانتظار الدفع.');
      }

      // The name was only held during the payment window; check it again.
      const availability = await getUsernameAvailability(order.username, { ignoreOrderId: order.id });

      if (!availability.available) {
        throw new HttpError(409, `اسم الرابط «${order.username}» لم يعد متاحًا. ألغِ الطلب وأنشئه باسم آخر.`);
      }

      const userResult = await client.query<{ id: string }>(
        'insert into users (email, phone) values ($1, $2) returning id',
        [order.customer_email, order.customer_phone],
      );

      const userId = userResult.rows[0].id;

      await client.query('insert into usernames (user_id, username) values ($1, $2)', [userId, order.username]);
      await ensurePageForUser(userId, client);

      const page = order.page_json ?? {};

      await savePageData(userId, { ...page, name: page.name ?? order.customer_name }, { client, mediaOwnerId: order.partner_id });

      await activateSubscription(userId, order.plan, `شريك #${order.order_number}: ${reference}`, client);

      // B2B-11: the price the partner sold at is kept for the renewals.
      await client.query('update subscriptions set custom_price = $2 where user_id = $1', [userId, order.sale_price]);

      await client.query(
        `update partner_orders
         set status = 'completed', completed_at = now(), user_id = $2, payment_reference = $3
         where id = $1`,
        [order.id, userId, reference],
      );

      // B2B-10: first-sale profit = sale price − the price set for the partner.
      await client.query(
        "insert into partner_commissions (partner_id, order_id, kind, amount) values ($1, $2, 'first', $3)",
        // Note 61: the design fee the partner set is the partner's own.
        [order.partner_id, order.id, Number(order.sale_price) - Number(order.partner_price) + Number(order.design_price ?? 0)],
      );

      await recordPayment(client, {
        userId,
        kind: 'partner_subscription',
        amount: Number(order.sale_price) + Number(order.design_price ?? 0),
        reference,
        label: `${order.username} — ${order.shop_name} #${order.order_number}`,
        recordedBy,
      });

      const setupLink = await createSetupLink(userId, origin, client);

      await client.query('commit');
      return { userId, setupLink, order };

    } catch (error: any) {
      await client.query('rollback');

      if (error?.code === '23505') {
        throw new HttpError(409, 'يوجد حساب في عنوان بهذا البريد أو الجوال أو اسم الرابط. ألغِ الطلب وأنشئه ببيانات صحيحة.');
      }

      throw error;
    } finally {
      client.release();
    }
}

export const partnerAdminHandlers: Record<string, Handler> = {
  'partners.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `
          select p.id, p.shop_name, p.contact_name, p.email, p.phone, p.city, p.status, p.created_at,
                 p.price_monthly::float, p.price_annual::float, p.renewal_rate::float,
                 (select count(*)::int from partner_orders o where o.partner_id = p.id and o.status = 'completed') as customers,
                 (select count(*)::int from partner_orders o where o.partner_id = p.id and o.status = 'awaiting_payment') as awaiting
          from partners p
          where p.status <> 'deleted'
          order by (p.status = 'pending') desc, p.created_at desc
        `,
      );

      return { partners: result.rows };
    },
  },

  // PERM-14: totals, commissions and payouts are the manager's; other
  // employees see the partner and the orders they have to process.
  'partners.get': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const isManager = staff.role === 'manager';

      const [details, orders, commissions, payouts] = await Promise.all([
        pool.query(
          `select id, shop_name, contact_name, email, phone, city, status, status_reason, created_at, to_jsonb(partners)->>'slug' as slug,
                  price_monthly::float, price_annual::float, renewal_rate::float
           from partners where id = $1`,
          [partner.id],
        ),
        pool.query(
          `select id, order_number, customer_name, customer_phone, customer_email, username, plan,
                  sale_price::float, partner_price::float, status, created_at, completed_at, cancelled_at, user_id,
                  coalesce((to_jsonb(partner_orders)->>'design_price')::float, 0) as design_price, payment_reference,
                  -- Note 69: what was actually recorded as received, from the payments ledger only.
                  (select coalesce(sum(pay.amount), 0)::float from payments pay
                    where pay.user_id = partner_orders.user_id and pay.kind = 'partner_subscription') as collected
           from partner_orders where partner_id = $1 order by created_at desc limit 300`,
          [partner.id],
        ),
        isManager
          ? pool.query(
              `select c.id, c.kind, c.amount::float, c.rate::float, c.created_at, o.order_number, o.customer_name, o.sale_price::float
               from partner_commissions c join partner_orders o on o.id = c.order_id
               where c.partner_id = $1 order by c.created_at desc limit 300`,
              [partner.id],
            )
          : null,
        isManager
          ? pool.query(
              `select id, amount::float, renewals_count, note, recorded_by, paid_at
               from partner_payouts where partner_id = $1 order by paid_at desc limit 100`,
              [partner.id],
            )
          : null,
      ]);

      return {
        partner: details.rows[0],
        orders: orders.rows,
        commissions: commissions?.rows ?? null,
        payouts: payouts?.rows ?? null,
        totals: isManager ? await getPartnerTotals(partner.id) : null,
      };
    },
  },

  // B2B-01: the administration may add a partner directly (already approved).
  'partners.create': {
    access: 'staff',
    run: async (params, staff) => {
      const email = normalizeEmail(params.email);
      const phone = normalizePhone(params.phone);
      const shopName = requireText(params.shopName, 'اسم المحل مطلوب.', 2);
      const contactName = requireText(params.contactName, 'اسم المسؤول مطلوب.', 2);
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);

      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      if (!isValidPhone(phone)) throw new HttpError(400, 'رقم الجوال غير صالح.');
      if (passwordError) throw new HttpError(400, passwordError);

      try {
        const result = await pool.query<PartnerRow>(
          `insert into partners (shop_name, contact_name, email, phone, city, password_hash, status)
           values ($1, $2, $3, $4, $5, $6, 'active') returning id, shop_name, status`,
          [shopName, contactName, email, phone, String(params.city ?? '').trim() || null, hashPassword(password)],
        );

        await audit(staff, 'partner.create', partnerTarget(result.rows[0]));
        return { id: result.rows[0].id };
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new HttpError(409, 'يوجد شريك بهذا البريد.');
        }

        throw error;
      }
    },
  },

  // PERM-10: any employee approves or stops a partner.
  'partners.approve': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);

      if (!['pending', 'rejected'].includes(partner.status)) {
        throw new HttpError(409, 'هذا الشريك ليس بانتظار الموافقة.');
      }

      return setStatus(staff, partner, 'active', 'partner.approve');
    },
  },

  'partners.reject': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);

      if (partner.status !== 'pending') {
        throw new HttpError(409, 'هذا الشريك ليس بانتظار الموافقة.');
      }

      return setStatus(staff, partner, 'rejected', 'partner.reject', String(params.reason ?? '').trim() || null);
    },
  },

  // B2B-15: an ordinary stop keeps renewal commissions; a violation stops
  // future ones. Records are never deleted.
  'partners.suspend': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const reason = requireText(params.reason, 'اكتب سبب الإيقاف.');

      if (partner.status !== 'active' && !(partner.status === 'suspended' && params.violation === true)) {
        throw new HttpError(409, 'الشريك غير مفعّل.');
      }

      return params.violation === true
        ? setStatus(staff, partner, 'violation', 'partner.violation', reason)
        : setStatus(staff, partner, 'suspended', 'partner.suspend', reason);
    },
  },

  // PERM-11 / B2B-16: only the manager brings back a partner stopped for a violation.
  // Note 57: the partner's own link (slug.onwan.link). The name must be free
  // of any customer page or hold, and is reserved so no customer can take it.
  'partners.setSlug': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const current = (await pool.query<{ slug: string | null }>('select slug from partners where id = $1', [partner.id])).rows[0]?.slug ?? null;
      const wanted = String(params.slug ?? '').trim().toLowerCase();

      if (wanted && wanted !== current) {
        const availability = await getUsernameAvailability(wanted);
        if (!availability.available) throw new HttpError(409, availability.reason ?? 'هذا الاسم غير متاح.');
      }

      const client = await pool.connect();
      try {
        await client.query('begin');
        if (current && current !== wanted) await client.query('delete from reserved_usernames where username = $1', [current]);
        if (wanted && wanted !== current) await client.query('insert into reserved_usernames (username) values ($1) on conflict do nothing', [wanted]);
        await client.query('update partners set slug = $2, updated_at = now() where id = $1', [partner.id, wanted || null]);
        await client.query('commit');
      } catch (error: any) {
        await client.query('rollback');
        if (error?.code === '23505') throw new HttpError(409, 'هذا الاسم مستخدم لشريك آخر.');
        throw error;
      } finally {
        client.release();
      }

      await audit(staff, 'partner.setSlug', partnerTarget(partner), { slug: wanted || null, previous: current });
      return { slug: wanted || null };
    },
  },

  'partners.reactivate': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);

      if (!['suspended', 'violation'].includes(partner.status)) {
        throw new HttpError(409, 'الشريك غير موقوف.');
      }

      if (partner.status === 'violation' && staff.role !== 'manager') {
        throw new HttpError(403, 'إعادة تفعيل شريك موقوف لمخالفة لمدير عنوان فقط.');
      }

      return setStatus(staff, partner, 'active', 'partner.reactivate');
    },
  },

  // PERM-12 / B2B-16: the account goes; orders, commissions and payouts stay.
  'partners.delete': {
    access: 'manager',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const reason = requireText(params.reason, 'اكتب سبب الحذف.');

      // The email is released so the unique index does not block a future partner.
      await pool.query(
        `update partners
         set status = 'deleted', status_reason = $2, email = 'deleted+' || id || '@invalid', updated_at = now()
         where id = $1`,
        [partner.id, reason],
      );

      await pool.query(
        "update partner_orders set status = 'cancelled', cancelled_at = now() where partner_id = $1 and status in ('awaiting_payment', 'draft')",
        [partner.id],
      );

      await audit(staff, 'partner.delete', partnerTarget(partner), { reason });
      return { ok: true };
    },
  },

  // PERM-08 / B2B-10: the manager sets each partner's price (their sale floor).
  'partners.setPrices': {
    access: 'manager',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const priceMonthly = parsePrice(params.priceMonthly);
      const priceAnnual = parsePrice(params.priceAnnual);

      await pool.query('update partners set price_monthly = $2, price_annual = $3, updated_at = now() where id = $1', [
        partner.id,
        priceMonthly,
        priceAnnual,
      ]);

      await audit(staff, 'partner.setPrices', partnerTarget(partner), { priceMonthly, priceAnnual });
      return { ok: true };
    },
  },

  // PERM-09: any employee adjusts a partner's commission percentage.
  'partners.setRate': {
    access: 'staff',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const rate = Number(params.renewalRate);

      if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
        throw new HttpError(400, 'النسبة يجب أن تكون بين 0 و100.');
      }

      await pool.query('update partners set renewal_rate = $2, updated_at = now() where id = $1', [partner.id, rate]);
      await audit(staff, 'partner.setRate', partnerTarget(partner), { renewalRate: rate });
      return { ok: true };
    },
  },

  // Unpaid partner orders stay here after they leave the partner's view (B2B-06).
  'partnerOrders.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `select o.id, o.order_number, o.customer_name, o.customer_phone, o.customer_email, o.username, o.plan,
                o.sale_price::float, o.status, o.created_at, p.id as partner_id, p.shop_name
         from partner_orders o join partners p on p.id = o.partner_id
         where o.status = 'awaiting_payment'
         order by o.created_at desc limit 200`,
      );

      return { orders: result.rows };
    },
  },

  // PERM-07: the employee confirms the customer's payment (received outside
  // the system until the gateway exists). This is where the customer's own
  // account is born: page published, the partner's access ends (B2B-05), the
  // first-sale profit is recorded (B2B-10) and the customer gets a one-time
  // link to create their password.
  'partnerOrders.confirmPayment': {
    access: 'staff',
    run: async (params, staff, context) => {
      const reference = requireText(params.reference, 'اكتب مرجع الدفع أو ملاحظة عن السداد.');
      const { userId, setupLink, order } = await completePartnerOrder(String(params.id ?? ''), reference, staff.name, context.origin);

      const emailed = await sendNoticeEmail(order.customer_email, 'حسابك في عنوان جاهز', [
        `مرحبًا ${order.customer_name}،`,
        'تم تأكيد اشتراكك وصفحتك منشورة الآن.',
        'أنشئ كلمة مرورك من الرابط التالي (يُستخدم مرة واحدة):',
        setupLink,
        'الحساب مستقل وملكك وحدك؛ لا يملك المحل الذي سجّلك أي صلاحية عليه.',
      ]);

      await audit(staff, 'partnerOrder.confirmPayment', { type: 'customer', id: userId, label: order.username }, {
        orderNumber: order.order_number,
        partner: order.shop_name,
        reference,
        emailed,
      });

      // Shown once to the employee so it can also be passed on by WhatsApp.
      return { userId, setupLink, emailed };
    },
  },

  'partnerOrders.cancel': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ order_number: number; customer_name: string }>(
        `update partner_orders set status = 'cancelled', cancelled_at = now()
         where id = $1 and status = 'awaiting_payment' returning order_number, customer_name`,
        [String(params.id ?? '')],
      );

      if (!result.rows[0]) {
        throw new HttpError(409, 'الطلب غير موجود أو ليس بانتظار الدفع.');
      }

      await audit(staff, 'partnerOrder.cancel', {
        type: 'partner_order',
        id: String(params.id),
        label: `#${result.rows[0].order_number} ${result.rows[0].customer_name}`,
      });

      return { ok: true };
    },
  },

  // The amount of a recorded renewal, entered by the manager until the base
  // of the percentage is decided (P-04).
  'partners.setCommissionAmount': {
    access: 'manager',
    run: async (params, staff) => {
      const amount = Math.round(Number(params.amount) * 100) / 100;

      if (!Number.isFinite(amount) || amount < 0 || amount > 1000000) {
        throw new HttpError(400, 'أدخل مبلغًا صحيحًا.');
      }

      const result = await pool.query<{ partner_id: string }>(
        "update partner_commissions set amount = $2 where id = $1 and kind = 'renewal' returning partner_id",
        [String(params.commissionId ?? ''), amount],
      );

      if (!result.rows[0]) {
        throw new HttpError(404, 'عمولة التجديد غير موجودة.');
      }

      await audit(staff, 'partner.setCommissionAmount', partnerTarget(await loadPartner(result.rows[0].partner_id)), {
        commissionId: params.commissionId,
        amount,
      });

      return { ok: true };
    },
  },

  // PERM-13 / B2B-14: the transfer happens outside the system; the manager records it.
  'partners.recordPayout': {
    access: 'manager',
    run: async (params, staff) => {
      const partner = await loadPartner(params.id);
      const amount = Math.round(Number(params.amount) * 100) / 100;
      const renewalsCount = Math.max(0, Math.floor(Number(params.renewalsCount) || 0));

      if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000) {
        throw new HttpError(400, 'أدخل مبلغ الصرف.');
      }

      await pool.query(
        'insert into partner_payouts (partner_id, amount, renewals_count, note, recorded_by) values ($1, $2, $3, $4, $5)',
        [partner.id, amount, renewalsCount, String(params.note ?? '').trim() || null, staff.name],
      );

      await audit(staff, 'partner.recordPayout', partnerTarget(partner), { amount, renewalsCount });
      return { ok: true };
    },
  },
};
