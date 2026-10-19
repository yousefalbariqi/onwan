import { activateSubscription } from './account';
import type { Handler } from './admin';
import { audit, getCustomerLabel, requireText } from './admin';
import { pool } from './db';
import { HttpError } from './http';
import { MAX_LINKS, archiveLinks, getPageDataByUserId, savePageData } from './page';
import { attachToHosting, checkDns, dnsInstruction } from './domains';
import { DesignPackage, SETTING_KEYS, getDesignPrice, getSettings, recordPayment } from './services';

async function customer(userId: string | null) {
  return userId ? { type: 'customer', id: userId, label: await getCustomerLabel(userId) } : null;
}

async function loadPackage(id: unknown) {
  const result = await pool.query<DesignPackage & { user_id: string }>('select * from design_packages where id = $1', [
    String(id ?? ''),
  ]);

  if (!result.rows[0]) {
    throw new HttpError(404, 'الباقة غير موجودة.');
  }

  return result.rows[0];
}

export const serviceAdminHandlers: Record<string, Handler> = {
  // ---- Settings -------------------------------------------------------------

  'settings.get': {
    access: 'staff',
    run: async () => ({ settings: await getSettings(), designPriceSar: getDesignPrice() }),
  },

  // Prices and package size are the manager's (PERM-08).
  'settings.set': {
    access: 'manager',
    run: async (params, staff) => {
      const key = String(params.key ?? '');
      const value = Number(params.value);

      if (!(SETTING_KEYS as readonly string[]).includes(key)) {
        throw new HttpError(400, 'إعداد غير معروف.');
      }

      // A number of days; the prices may have halalas.
      const isCount = key === 'name_hold_days';

      if (!Number.isFinite(value) || value < (isCount ? 1 : 0) || value > 1000000 || (isCount && !Number.isInteger(value))) {
        throw new HttpError(400, 'أدخل قيمة صحيحة.');
      }

      await pool.query(
        `insert into settings (key, value) values ($1, $2::jsonb)
         on conflict (key) do update set value = excluded.value, updated_at = now()`,
        [key, JSON.stringify(value)],
      );

      await audit(staff, 'settings.set', { type: 'setting', id: key, label: key }, { value });
      return { settings: await getSettings() };
    },
  },

  // ---- «صمّم لي» (DES-01/02, NEW-06: one job, done at approval) -------------

  'design.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `
          select d.id, d.user_id, d.status, d.price::float, d.requested_at, d.paid_at, d.design_approved_at,
                 un.username, u.phone, u.email
          from design_packages d
          join users u on u.id = d.user_id
          left join customer_names un on un.user_id = d.user_id
          where d.status <> 'cancelled'
          order by (d.design_approved_at is null) desc, d.requested_at desc
          limit 200
        `,
      );

      return { packages: result.rows, designPriceSar: getDesignPrice() };
    },
  },

  'design.confirmPayment': {
    access: 'staff',
    run: async (params, staff) => {
      const pkg = await loadPackage(params.id);
      const reference = requireText(params.reference, 'اكتب مرجع الدفع.');
      const price = pkg.price === null ? getDesignPrice() : Number(pkg.price);

      if (pkg.status !== 'pending_payment') throw new HttpError(409, 'الطلب ليس بانتظار الدفع.');
      if (price === null) throw new HttpError(409, 'لم يُحدد سعر «صمّم لي» بعد (DESIGN_SERVICE_PRICE_SAR).');

      await pool.query(
        "update design_packages set status = 'active', paid_at = now(), price = $2, payment_reference = $3 where id = $1",
        [pkg.id, price, reference],
      );

      const target = await customer(pkg.user_id);

      await recordPayment(pool, {
        userId: pkg.user_id,
        kind: 'design',
        amount: price,
        reference,
        label: target?.label ?? '',
        recordedBy: staff.name,
      });

      await audit(staff, 'design.confirmPayment', target, { price, reference });
      return { ok: true };
    },
  },

  // DES-02 / NEW-06: the customer approves over WhatsApp; recording it here
  // closes the service.
  'design.approve': {
    access: 'staff',
    run: async (params, staff) => {
      const pkg = await loadPackage(params.id);

      if (pkg.status !== 'active' || pkg.design_approved_at) {
        throw new HttpError(409, 'الطلب غير مدفوع أو سُجّل اعتماد تصميمه من قبل.');
      }

      await pool.query('update design_packages set design_approved_at = now() where id = $1', [pkg.id]);
      await audit(staff, 'design.approve', await customer(pkg.user_id));
      return { ok: true };
    },
  },

  'design.cancel': {
    access: 'staff',
    run: async (params, staff) => {
      const pkg = await loadPackage(params.id);

      if (pkg.status !== 'pending_payment') throw new HttpError(409, 'لا تُلغى إلا الباقة التي لم تُدفع.');

      await pool.query("update design_packages set status = 'cancelled' where id = $1", [pkg.id]);
      await audit(staff, 'design.cancel', await customer(pkg.user_id));
      return { ok: true };
    },
  },

  // ---- NFC orders (NFC-02/03, AC-13) ----------------------------------------

  'nfc.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `select n.id, n.order_number, n.user_id, n.quantity, n.unit_price::float, n.shipping_price::float, n.total::float,
                n.recipient_name, n.recipient_phone, n.city, n.address, n.page_url, n.status, n.payment_reference,
                n.shipping_note, n.contact_note, n.created_at, n.paid_at, n.contacted_at, n.shipped_at
         from nfc_orders n
         order by (n.status in ('paid', 'contacted')) desc, n.created_at desc
         limit 200`,
      );

      return { orders: result.rows };
    },
  },

  'nfc.confirmPayment': {
    access: 'staff',
    run: async (params, staff) => {
      const reference = requireText(params.reference, 'اكتب مرجع الدفع.');

      const result = await pool.query(
        `update nfc_orders set status = 'paid', paid_at = now(), payment_reference = $2
         where id = $1 and status = 'pending_payment'
         returning user_id, order_number, total::float`,
        [String(params.id ?? ''), reference],
      );

      const order = result.rows[0];

      if (!order) throw new HttpError(409, 'الطلب غير موجود أو ليس بانتظار الدفع.');

      await recordPayment(pool, {
        userId: order.user_id,
        kind: 'nfc',
        amount: order.total,
        reference,
        label: `NFC #${order.order_number}`,
        recordedBy: staff.name,
      });

      await audit(staff, 'nfc.confirmPayment', { type: 'nfc_order', id: String(params.id), label: `#${order.order_number}` }, {
        total: order.total,
        reference,
      });

      return { ok: true };
    },
  },

  // NEW-07 / NFC-03 (amended): the customer is contacted before anything ships.
  'nfc.markContacted': {
    access: 'staff',
    run: async (params, staff) => {
      const note = requireText(params.note, 'اكتب ما تم الاتفاق عليه مع العميل.');

      const result = await pool.query<{ order_number: number }>(
        `update nfc_orders set status = 'contacted', contacted_at = now(), contact_note = $2
         where id = $1 and status = 'paid' returning order_number`,
        [String(params.id ?? ''), note],
      );

      // AC-13: nothing is prepared before the payment is confirmed.
      if (!result.rows[0]) throw new HttpError(409, 'يُسجَّل التواصل على طلب مؤكد الدفع فقط.');

      await audit(staff, 'nfc.markContacted', { type: 'nfc_order', id: String(params.id), label: `#${result.rows[0].order_number}` }, { note });
      return { ok: true };
    },
  },

  'nfc.ship': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ order_number: number }>(
        `update nfc_orders set status = 'shipped', shipped_at = now(), shipping_note = $2
         where id = $1 and status = 'contacted' returning order_number`,
        [String(params.id ?? ''), String(params.note ?? '').trim() || null],
      );

      if (!result.rows[0]) throw new HttpError(409, 'لا يُشحن الطلب قبل تأكيد الدفع والتواصل مع العميل.');

      await audit(staff, 'nfc.ship', { type: 'nfc_order', id: String(params.id), label: `#${result.rows[0].order_number}` });
      return { ok: true };
    },
  },

  'nfc.cancel': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ order_number: number }>(
        "update nfc_orders set status = 'cancelled' where id = $1 and status = 'pending_payment' returning order_number",
        [String(params.id ?? '')],
      );

      if (!result.rows[0]) throw new HttpError(409, 'لا يُلغى إلا طلب لم يُدفع.');

      await audit(staff, 'nfc.cancel', { type: 'nfc_order', id: String(params.id), label: `#${result.rows[0].order_number}` });
      return { ok: true };
    },
  },

  // ---- Customer content (PERM-01, PERM-19) ----------------------------------

  'content.getPage': {
    access: 'staff',
    run: async (params) => {
      const target = await customer(String(params.userId ?? ''));
      return { pageData: await getPageDataByUserId(target!.id), label: target!.label };
    },
  },

  // PERM-01: any employee edits a customer's page. Same validation as the
  // customer's own save; recorded as reviewed by that employee.
  'content.save': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customer(String(params.userId ?? ''));
      const pageData = await savePageData(target!.id, params.pageData ?? {}, { staffName: staff.name });

      await audit(staff, 'content.save', target);
      return { pageData };
    },
  },

  // PERM-19: only the manager sees and restores what was deleted.
  'content.listDeleted': {
    access: 'manager',
    run: async (params) => {
      const result = await pool.query(
        `select d.id, d.deleted_by, d.deleted_at,
                d.link_json->>'title' as title, d.link_json->>'link_type' as link_type,
                d.link_json->>'file_name' as file_name,
                case when d.link_json->>'link_type' = 'file' then null else d.link_json->>'url' end as url
         from deleted_links d join pages p on p.id = d.page_id
         where p.user_id = $1
         order by d.deleted_at desc limit 100`,
        [String(params.userId ?? '')],
      );

      return { deleted: result.rows };
    },
  },

  'content.restoreLink': {
    access: 'manager',
    run: async (params, staff) => {
      const client = await pool.connect();

      try {
        await client.query('begin');

        const archived = await client.query<{ page_id: string; user_id: string; link_json: any }>(
          `select d.page_id, p.user_id, d.link_json
           from deleted_links d join pages p on p.id = d.page_id
           where d.id = $1 for update of d`,
          [String(params.id ?? '')],
        );

        const row = archived.rows[0];

        if (!row) throw new HttpError(404, 'العنصر المحذوف غير موجود.');

        const count = await client.query<{ count: number }>(
          'select count(*)::int as count from page_links where page_id = $1',
          [row.page_id],
        );

        if (count.rows[0].count >= MAX_LINKS) {
          throw new HttpError(409, `الصفحة فيها ${MAX_LINKS} زرًا بالفعل؛ لا يمكن الاستعادة قبل حذف زر.`);
        }

        // Back at the end of the list, hidden, so nothing reappears publicly
        // without someone deciding to show it.
        await client.query(
          `insert into page_links
             (page_id, title, url, link_type, file_category, file_name, file_mime_type, file_size, platform,
              sort_order, icon_style, text_position, is_hidden, title_en, custom_icon, display_json)
           select $1, r.title, r.url, coalesce(r.link_type, 'url'), r.file_category, r.file_name, r.file_mime_type,
                  r.file_size, r.platform, 1000, r.icon_style, r.text_position, true, r.title_en, r.custom_icon, coalesce(r.display_json, '{}'::jsonb)
           from jsonb_populate_record(null::page_links, $2::jsonb) r`,
          [row.page_id, JSON.stringify(row.link_json)],
        );

        await client.query('delete from deleted_links where id = $1', [String(params.id)]);
        await client.query('commit');

        await audit(staff, 'content.restoreLink', await customer(row.user_id), { title: row.link_json?.title });
        return { ok: true };
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    },
  },

  // ---- Registration cart (NEW-04) --------------------------------------------

  'carts.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `select c.id, c.cart_number, c.user_id, c.plan, c.plan_price::float, c.design_price::float, c.nfc_quantity,
                c.total::float, c.created_at, un.username, u.email, u.phone
         from registration_carts c
         join users u on u.id = c.user_id
         left join customer_names un on un.user_id = c.user_id
         where c.status = 'pending_payment'
         order by c.created_at desc limit 200`,
      );

      return { carts: result.rows };
    },
  },

  // One confirmation for the whole cart (PERM-07): the subscription starts
  // and the name is fixed, «صمّم لي» opens as paid, and the NFC order enters
  // the queue as paid. All or nothing.
  'carts.confirmPayment': {
    access: 'staff',
    run: async (params, staff) => {
      const reference = requireText(params.reference, 'اكتب مرجع الدفع أو ملاحظة عن السداد.');
      const client = await pool.connect();

      try {
        await client.query('begin');

        const cartResult = await client.query(
          "select * from registration_carts where id = $1 and status = 'pending_payment' for update",
          [String(params.id ?? '')],
        );

        const cart = cartResult.rows[0];

        if (!cart) throw new HttpError(409, 'السلة غير موجودة أو ليست بانتظار الدفع.');

        const label = `سلة #${cart.cart_number}`;
        const pay = (kind: 'subscription' | 'design' | 'nfc' | 'domain', amount: number) =>
          recordPayment(client, { userId: cart.user_id, kind, amount, reference, label, recordedBy: staff.name });

        await activateSubscription(cart.user_id, cart.plan, `${label}: ${reference}`, client);
        await pay('subscription', Number(cart.plan_price));

        if (cart.design_price !== null) {
          await client.query(
            `insert into design_packages (user_id, status, price, payment_reference, paid_at)
             values ($1, 'active', $2, $3, now())`,
            [cart.user_id, cart.design_price, reference],
          );
          await pay('design', Number(cart.design_price));
        }

        if (cart.nfc_quantity > 0) {
          const nfcTotal = cart.nfc_quantity * Number(cart.nfc_unit_price) + Number(cart.nfc_shipping_price);

          // The address is the name that was just fixed by this payment.
          await client.query(
            `insert into nfc_orders
               (user_id, quantity, unit_price, shipping_price, total, recipient_name, recipient_phone, city, address,
                page_url, status, payment_reference, paid_at)
             select $1, $2, $3, $4, $5, $6, $7, $8, $9, 'https://' || un.username || '.' || $10, 'paid', $11, now()
             from usernames un where un.user_id = $1`,
            [
              cart.user_id,
              cart.nfc_quantity,
              cart.nfc_unit_price,
              cart.nfc_shipping_price,
              nfcTotal,
              cart.nfc_recipient_name,
              cart.nfc_recipient_phone,
              cart.nfc_city,
              cart.nfc_address,
              process.env.ROOT_DOMAIN || 'onwan.link',
              reference,
            ],
          );
          await pay('nfc', nfcTotal);
        }

        if (cart.custom_domain) {
          // Paid for here; the customer connects it from their account next.
          await client.query(
            `insert into custom_domains (user_id, domain, price, status, payment_reference, paid_at)
             values ($1, $2, $3, 'awaiting_dns', $4, now())`,
            [cart.user_id, cart.custom_domain, cart.domain_price, reference],
          );
          await pay('domain', Number(cart.domain_price));
        }

        await client.query(
          "update registration_carts set status = 'paid', paid_at = now(), payment_reference = $2 where id = $1",
          [cart.id, reference],
        );

        // PAY-03: a use is counted when it is paid for, not when it is typed.
        if (cart.discount_code) {
          await client.query('update discount_codes set used_count = used_count + 1 where code = $1', [cart.discount_code]);
        }

        await client.query('commit');

        await audit(staff, 'cart.confirmPayment', await customer(cart.user_id), {
          cartNumber: cart.cart_number,
          total: Number(cart.total),
          reference,
        });

        return { ok: true };
      } catch (error: any) {
        await client.query('rollback');

        if (error?.code === '23505' && String(error.constraint ?? '').includes('custom_domains')) {
          throw new HttpError(409, 'دومين السلة صار مسجّلًا لصفحة أخرى. اطلب من العميل تعديل السلة.');
        }

        throw error;
      } finally {
        client.release();
      }
    },
  },

  // ---- Custom domains (DOMAIN-03) --------------------------------------------

  'domains.list': {
    access: 'staff',
    run: async () => {
      const result = await pool.query(
        `select d.id, d.user_id, d.domain, d.price::float, d.status, d.created_at, d.verified_at, d.activated_at,
                un.username
         from custom_domains d left join customer_names un on un.user_id = d.user_id
         where d.status <> 'removed'
         order by (d.status = 'dns_verified') desc, d.created_at desc limit 200`,
      );

      return {
        domains: result.rows.map((row) => ({ ...row, instruction: dnsInstruction(row.domain) })),
        hostingConfigured: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID),
      };
    },
  },

  'domains.confirmPayment': {
    access: 'staff',
    run: async (params, staff) => {
      const reference = requireText(params.reference, 'اكتب مرجع الدفع.');

      const result = await pool.query(
        `update custom_domains set status = 'awaiting_dns', paid_at = now(), payment_reference = $2
         where id = $1 and status = 'pending_payment' returning user_id, domain, price::float`,
        [String(params.id ?? ''), reference],
      );

      const row = result.rows[0];

      if (!row) throw new HttpError(409, 'الطلب غير موجود أو ليس بانتظار الدفع.');

      await recordPayment(pool, { userId: row.user_id, kind: 'domain', amount: row.price, reference, label: row.domain, recordedBy: staff.name });
      await audit(staff, 'domain.confirmPayment', await customer(row.user_id), { domain: row.domain, price: row.price, reference });
      return { ok: true };
    },
  },

  // The employee can re-run the DNS check instead of waiting for the customer.
  'domains.verify': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ user_id: string; domain: string }>(
        "select user_id, domain from custom_domains where id = $1 and status = 'awaiting_dns'",
        [String(params.id ?? '')],
      );

      const row = result.rows[0];

      if (!row) throw new HttpError(409, 'الدومين ليس بانتظار التحقق.');
      if (!(await checkDns(row.domain))) throw new HttpError(409, 'سجل DNS غير موجود أو لا يشير إلينا بعد.');

      await pool.query("update custom_domains set status = 'dns_verified', verified_at = now() where id = $1", [String(params.id)]);
      await audit(staff, 'domain.verify', await customer(row.user_id), { domain: row.domain });
      return { ok: true };
    },
  },

  // Only a domain whose DNS was verified goes live. With the hosting API
  // configured it is attached automatically; otherwise the employee confirms
  // they added it in the hosting dashboard.
  'domains.activate': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ user_id: string; domain: string }>(
        "select user_id, domain from custom_domains where id = $1 and status = 'dns_verified'",
        [String(params.id ?? '')],
      );

      const row = result.rows[0];

      if (!row) throw new HttpError(409, 'لا يُفعَّل إلا دومين تم التحقق من سجله.');

      const hosting = await attachToHosting(row.domain);

      if (hosting === 'not_configured' && params.addedManually !== true) {
        throw new HttpError(409, 'الربط الآلي بالاستضافة غير مهيأ. أضف الدومين في لوحة Vercel ثم أكّد ذلك هنا.');
      }

      await pool.query("update custom_domains set status = 'active', activated_at = now() where id = $1", [String(params.id)]);
      await audit(staff, 'domain.activate', await customer(row.user_id), { domain: row.domain, hosting });
      return { ok: true };
    },
  },

  'domains.remove': {
    access: 'staff',
    run: async (params, staff) => {
      const reason = requireText(params.reason, 'اكتب سبب الإزالة.');

      const result = await pool.query<{ user_id: string; domain: string }>(
        "update custom_domains set status = 'removed' where id = $1 and status <> 'removed' returning user_id, domain",
        [String(params.id ?? '')],
      );

      if (!result.rows[0]) throw new HttpError(404, 'الدومين غير موجود.');

      await audit(staff, 'domain.remove', await customer(result.rows[0].user_id), { domain: result.rows[0].domain, reason });
      return { ok: true };
    },
  },

  // ---- Reports (PERM-14: manager only) --------------------------------------

  'reports.summary': {
    access: 'manager',
    run: async () => {
      const [counts, revenue, monthly, partners] = await Promise.all([
        pool.query(
          `
            select
              (select count(*)::int from users) as customers,
              (select count(*)::int from users where created_at > now() - interval '30 days') as new_customers_30d,
              (select count(*)::int from users where status = 'banned') as banned,
              (select count(*)::int from pages where status = 'published') as published,
              (select count(*)::int from pages where status = 'draft') as drafts,
              (select count(*)::int from pages where status = 'suspended') as suspended,
              (select count(*)::int from subscriptions where status = 'active' and expires_at > now() and plan = 'monthly') as active_monthly,
              (select count(*)::int from subscriptions where status = 'active' and expires_at > now() and plan = 'annual') as active_annual,
              (select count(*)::int from subscriptions s join pages p on p.user_id = s.user_id
                 where s.expires_at < now() and p.status = 'published') as overdue,
              (select count(*)::int from content_reviews where status = 'pending') as pending_reviews,
              (select count(*)::int from support_requests where status <> 'completed') as open_requests,
              (select count(*)::int from page_reports where handled_at is null) as open_reports,
              (select count(*)::int from design_packages where status = 'active') as design_packages,
              (select count(*)::int from registration_carts where status = 'pending_payment') as open_carts,
              (select count(*)::int from nfc_orders where status in ('paid', 'contacted', 'shipped')) as nfc_orders,
              (select coalesce(sum(quantity), 0)::int from nfc_orders where status in ('paid', 'contacted', 'shipped')) as nfc_pieces
          `,
        ),
        pool.query(
          `select kind, count(*)::int as count, coalesce(sum(amount), 0)::float as total
           from payments group by kind order by kind`,
        ),
        pool.query(
          `select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
                  count(*)::int as count, coalesce(sum(amount), 0)::float as total
           from payments
           where created_at > date_trunc('month', now()) - interval '11 months'
           group by 1 order by 1 desc`,
        ),
        pool.query(
          `
            select
              (select count(*)::int from partners where status = 'active') as active_partners,
              (select count(*)::int from partners where status = 'pending') as pending_partners,
              (select count(*)::int from partner_orders where status = 'completed') as partner_customers,
              (select coalesce(sum(amount), 0)::float from partner_commissions) as commissions_earned,
              (select coalesce(sum(amount), 0)::float from partner_payouts) as commissions_paid,
              (select count(*)::int from partner_commissions where kind = 'renewal' and amount is null) as renewals_unpriced
          `,
        ),
      ]);

      return {
        counts: counts.rows[0],
        revenueByKind: revenue.rows,
        revenueByMonth: monthly.rows,
        partners: partners.rows[0],
      };
    },
  },
};
