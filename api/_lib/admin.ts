import { nonprofitAdminHandlers } from './nonprofitAdmin.js';
import { getReferralOffer } from './partnerReferral.js';
import { getEnv } from './runtime.js';
import crypto from 'node:crypto';
import { activateSubscription, getPlans, isPlan, isValidEmail, normalizeDiscountCode, normalizeEmail } from './account.js';
import { createSessionToken, getBearerToken, verifySessionToken } from './auth.js';
import { pool } from './db.js';
import { sendNoticeEmail } from './email.js';
import { HttpError } from './http.js';
import { getPageDataByUserId } from './page.js';
import { hashPassword, validatePassword, verifyPassword } from './password.js';
import { getUsernameAvailability } from './username.js';
import { assertNotLocked, clearFailures, recordFailure } from './loginGuard.js';
import { partnerAdminHandlers, recordPartnerRenewal } from './adminPartners.js';
import { serviceAdminHandlers } from './adminServices.js';
import { archiveLinks } from './page.js';
import { recordPayment } from './services.js';

export type Staff = {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'staff';
  permissions: string[];
  is_active: boolean;
};

// Authorisations the manager can grant to an individual employee. Everything
// else in the permissions matrix is either «أي موظف» or «المدير فقط».
// PERM-06: changing a page's link is for «الموظف المخوّل».
export const GRANTABLE_PERMISSIONS = ['change_subdomain'];

const REDIRECT_DAYS = 30;

export type AdminContext = { origin: string };

export type Handler = {
  // 'public' needs no session, 'staff' any active employee, 'manager' the manager only.
  access: 'public' | 'staff' | 'manager';
  permission?: string;
  run: (params: any, staff: Staff, context: AdminContext) => Promise<unknown>;
};

function publicStaff(staff: Staff) {
  return {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    permissions: staff.permissions ?? [],
    isActive: staff.is_active,
  };
}

export function requireText(value: unknown, message: string, min = 3) {
  const text = String(value ?? '').trim();

  if (text.length < min) {
    throw new HttpError(400, message);
  }

  return text;
}

export async function audit(
  staff: Staff,
  action: string,
  target: { type: string; id: string; label?: string } | null,
  details: Record<string, unknown> = {},
) {
  await pool.query(
    `insert into audit_log (staff_id, staff_name, action, target_type, target_id, target_label, details)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [staff.id, staff.name, action, target?.type ?? null, target?.id ?? null, target?.label ?? null, JSON.stringify(details)],
  );
}

export async function getCustomerLabel(userId: string) {
  const result = await pool.query<{ label: string }>(
    `select coalesce(un.username, u.email, u.phone) as label
     from users u left join customer_names un on un.user_id = u.id
     where u.id = $1`,
    [userId],
  );

  if (!result.rows[0]) {
    throw new HttpError(404, 'العميل غير موجود.');
  }

  return result.rows[0].label;
}

async function customerTarget(userId: unknown) {
  const id = String(userId ?? '');

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    throw new HttpError(400, 'معرّف العميل غير صالح.');
  }

  return { type: 'customer', id, label: await getCustomerLabel(id) };
}

const handlers: Record<string, Handler> = {
  ...nonprofitAdminHandlers,
  ...partnerAdminHandlers,
  ...serviceAdminHandlers,

  // First manager only: works while the staff table is empty and the caller
  // knows ADMIN_SETUP_TOKEN from the server environment.
  bootstrap: {
    access: 'public',
    run: async (params) => {
      const expected = getEnv('ADMIN_SETUP_TOKEN') ?? '';
      const provided = Buffer.from(String(params.setupToken ?? ''));

      if (
        expected.length < 16 ||
        provided.length !== expected.length ||
        !crypto.timingSafeEqual(provided, Buffer.from(expected))
      ) {
        throw new HttpError(403, 'رمز الإعداد غير صحيح أو غير مهيأ في الخادم.');
      }

      const existing = await pool.query('select 1 from staff limit 1');

      if (existing.rowCount) {
        throw new HttpError(409, 'تم إعداد حساب المدير مسبقًا.');
      }

      const email = normalizeEmail(params.email);
      const name = requireText(params.name, 'الاسم مطلوب.', 2);
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);

      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      if (passwordError) throw new HttpError(400, passwordError);

      const result = await pool.query<Staff>(
        `insert into staff (email, name, password_hash, role) values ($1, $2, $3, 'manager') returning *`,
        [email, name, hashPassword(password)],
      );

      const staff = result.rows[0];
      await audit(staff, 'staff.bootstrap', { type: 'staff', id: staff.id, label: staff.name });

      return { token: createSessionToken(staff.id, staff.email, 'staff'), staff: publicStaff(staff) };
    },
  },

  login: {
    access: 'public',
    run: async (params) => {
      const email = normalizeEmail(params.email);
      await assertNotLocked('staff', email);
      const result = await pool.query<Staff & { password_hash: string }>(
        'select * from staff where email = $1 limit 1',
        [email],
      );

      const staff = result.rows[0];

      if (!staff || !verifyPassword(String(params.password ?? ''), staff.password_hash)) {
        await recordFailure('staff', email);
        throw new HttpError(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }

      if (!staff.is_active) {
        throw new HttpError(403, 'هذا الحساب موقوف. راجع مدير عنوان.');
      }

      await clearFailures('staff', email);
      return { token: createSessionToken(staff.id, staff.email, 'staff'), staff: publicStaff(staff) };
    },
  },

  me: { access: 'staff', run: async (_params, staff) => ({ staff: publicStaff(staff) }) },

  // ---- Customers -----------------------------------------------------------

  'customers.list': {
    access: 'staff',
    run: async (params) => {
      const q = String(params.q ?? '').trim();
      const filter = String(params.filter ?? 'all');
      const filters: Record<string, string> = {
        all: 'true',
        // SUB-06 / AC-05: subscription ended, page still visible.
        overdue: "s.expires_at < now() and p.status = 'published'",
        suspended: "p.status = 'suspended'",
        banned: "u.status = 'banned'",
        draft: "p.status = 'draft'",
        // NEW-04: registration carts waiting for their payment to be confirmed.
        cart: "exists (select 1 from registration_carts c where c.user_id = u.id and c.status = 'pending_payment')",
      };

      const result = await pool.query(
        `
          select
            u.id, u.email, u.phone, u.status as account_status, u.created_at,
            un.username, un.is_fixed as name_fixed, p.display_name, p.status as page_status, p.suspended_at,
            exists (select 1 from registration_carts c where c.user_id = u.id and c.status = 'pending_payment') as has_cart,
            s.plan, s.status as subscription_status, s.expires_at,
            case when s.expires_at < now()
              then floor(extract(epoch from now() - s.expires_at) / 86400)::int end as overdue_days
          from users u
          left join customer_names un on un.user_id = u.id
          left join pages p on p.user_id = u.id
          left join subscriptions s on s.user_id = u.id
          where (${filters[filter] ?? 'true'})
            and ($1 = '' or un.username ilike $2 or u.email ilike $2 or u.phone ilike $2 or p.display_name ilike $2)
          order by u.created_at desc
          limit 200
        `,
        [q, `%${q}%`],
      );

      return { customers: result.rows };
    },
  },

  // MOD-02: the administration can see the data, links and files.
  'customers.get': {
    access: 'staff',
    run: async (params) => {
      const target = await customerTarget(params.userId);

      const [customer, requests, cart, history] = await Promise.all([
        pool.query(
          `
            select
              u.id, u.email, u.phone, u.status as account_status, u.ban_reason, u.banned_at,
              u.email_verified_at, u.created_at,
              un.username, un.is_fixed as name_fixed, un.hold_expires_at, p.status as page_status, p.suspension_message, p.suspension_reason, p.suspended_at,
              case when p.suspended_at is not null
                then floor(extract(epoch from now() - p.suspended_at) / 86400)::int end as suspended_days,
              s.plan, s.status as subscription_status, s.starts_at, s.expires_at, s.payment_reference, s.custom_price,
              (select pr.shop_name from partner_orders po join partners pr on pr.id = po.partner_id
               where po.user_id = u.id and po.status = 'completed' limit 1) as partner_shop,
              case when s.expires_at < now()
                then floor(extract(epoch from now() - s.expires_at) / 86400)::int end as overdue_days
            from users u
            left join customer_names un on un.user_id = u.id
            left join pages p on p.user_id = u.id
            left join subscriptions s on s.user_id = u.id
            where u.id = $1
          `,
          [target.id],
        ),
        pool.query(
          'select id, type, message, status, due_at, created_at from support_requests where user_id = $1 order by created_at desc limit 20',
          [target.id],
        ),
        pool.query(
          `select id, cart_number, plan, plan_price::float, plan_list_price::float, general_discount::float,
                  discount_code, code_discount::float, custom_domain, domain_price::float, design_price::float, nfc_quantity, nfc_unit_price::float,
                  nfc_shipping_price::float, nfc_recipient_name, nfc_recipient_phone, nfc_city, nfc_address,
                  total::float, created_at
           from registration_carts where user_id = $1 and status = 'pending_payment'`,
          [target.id],
        ),
        pool.query(
          `select staff_name, action, details, created_at from audit_log
           where target_type = 'customer' and target_id = $1 order by created_at desc limit 30`,
          [target.id],
        ),
      ]);

      return {
        customer: customer.rows[0],
        pageData: await getPageDataByUserId(target.id),
        requests: requests.rows,
        cart: cart.rows[0] ?? null,
        history: history.rows,
      };
    },
  },

  // PERM-04 / SUB-07 / MOD-05: any employee stops a page; visitors see the
  // chosen message, the reason stays internal.
  'page.suspend': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      const message = requireText(params.message, 'اكتب الرسالة التي تظهر لزوار الصفحة.');
      const reason = requireText(params.reason, 'اكتب سبب الإيقاف (داخلي).');

      const result = await pool.query(
        `update pages set status = 'suspended', suspension_message = $2, suspension_reason = $3, suspended_at = now()
         where user_id = $1 and status = 'published'`,
        [target.id, message, reason],
      );

      if (!result.rowCount) {
        throw new HttpError(409, 'الصفحة ليست منشورة حاليًا.');
      }

      await audit(staff, 'page.suspend', target, { message, reason });
      return { ok: true };
    },
  },

  // PERM-04 / SUB-08: manual reactivation, design and data intact.
  'page.reactivate': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);

      const result = await pool.query(
        `update pages set status = 'published', suspension_message = null, suspension_reason = null, suspended_at = null
         where user_id = $1 and status = 'suspended'`,
        [target.id],
      );

      if (!result.rowCount) {
        throw new HttpError(409, 'الصفحة ليست موقوفة.');
      }

      await audit(staff, 'page.reactivate', target);
      return { ok: true };
    },
  },

  // PERM-02 / SUB-10: a violation ban blocks login (and so renewal) and hides the page.
  'user.ban': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      const reason = requireText(params.reason, 'اكتب سبب الحظر.');

      const result = await pool.query(
        "update users set status = 'banned', ban_reason = $2, banned_at = now() where id = $1 and status = 'active'",
        [target.id, reason],
      );

      if (!result.rowCount) {
        throw new HttpError(409, 'الحساب محظور بالفعل.');
      }

      await audit(staff, 'user.ban', target, { reason });
      return { ok: true };
    },
  },

  // Note 72: help a customer back in without ever seeing their password. The
  // employee confirms the identity check first; every step is in the audit log.
  'user.sendAccessLink': {
    access: 'staff',
    run: async (params, staff, context) => {
      const target = await customerTarget(params.userId);
      if (params.identityChecked !== true) throw new HttpError(400, 'تحقق من هوية العميل أولًا.');
      const user = await pool.query<{ email: string | null }>('select email from users where id = $1', [target.id]);
      const email = user.rows[0]?.email;
      if (!email) throw new HttpError(409, 'لا يوجد بريد مسجّل لهذا العميل.');
      const { createSetupLink } = await import('./partner.js');
      const link = await createSetupLink(target.id, context.origin);
      const emailed = await sendNoticeEmail(email, 'رابط تعيين كلمة المرور في عنوان', [
        'طلبت إدارة عنوان تعيين كلمة مرور جديدة لحسابك بناءً على طلبك.',
        'افتح الرابط التالي (يُستخدم مرة واحدة):',
        link,
        'إن لم تطلب ذلك فتجاهل هذه الرسالة.',
      ]);
      await audit(staff, 'user.sendAccessLink', target, { emailed });
      return { emailed };
    },
  },

  // Exceptional support only: a manager sets a one-time password, shown once,
  // that the customer must replace at the next sign-in.
  'user.tempPassword': {
    access: 'manager',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      if (params.identityChecked !== true) throw new HttpError(400, 'تحقق من هوية العميل أولًا.');
      const password = crypto.randomBytes(9).toString('base64url');
      await pool.query('update users set password_hash = $2, must_change_password = true, updated_at = now() where id = $1', [target.id, hashPassword(password)])
        .catch((error: any) => {
          if (error?.code === '42703') throw new HttpError(503, 'يلزم تشغيل ملف قاعدة البيانات phase18-temporary-passwords.sql.');
          throw error;
        });
      await audit(staff, 'user.tempPassword', target, {});
      return { password };
    },
  },

  // PERM-03: manager only.
  'user.unban': {
    access: 'manager',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);

      const result = await pool.query(
        "update users set status = 'active', ban_reason = null, banned_at = null where id = $1 and status = 'banned'",
        [target.id],
      );

      if (!result.rowCount) {
        throw new HttpError(409, 'الحساب غير محظور.');
      }

      await audit(staff, 'user.unban', target);
      return { ok: true };
    },
  },

  // PERM-07: manual subscription / renewal by any employee, after the payment
  // was received outside the system. Publishes a draft page; a suspended page
  // still needs an explicit reactivation (SUB-08).
  'subscription.activate': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      const reference = requireText(params.reference, 'اكتب مرجع الدفع أو ملاحظة عن السداد.');

      if (!isPlan(params.plan)) {
        throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
      }

      // PAY-05: what was actually collected is recorded with the payment.
      const amount = Math.round(Number(params.amount) * 100) / 100;

      if (params.amount === '' || params.amount === null || !Number.isFinite(amount) || amount < 0 || amount > 1000000) {
        throw new HttpError(400, 'أدخل المبلغ المحصّل بالريال.');
      }

      const firstReferral = await getReferralOffer(target.id);
      await activateSubscription(target.id, params.plan, `يدوي: ${reference}`);
      await recordPayment(pool, {
        userId: target.id,
        kind: 'subscription',
        amount,
        reference,
        label: target.label,
        recordedBy: staff.name,
      });
      const renewalRecorded = firstReferral ? false : await recordPartnerRenewal(target.id);
      await audit(staff, 'subscription.activate', target, { plan: params.plan, amount, reference, partnerRenewal: renewalRecorded });
      return { ok: true };
    },
  },

  // PERM-05 / SUB-09: final deletion, manager only. The name becomes free and
  // nothing of the page is kept for a later owner of the same link (AC-06).
  'user.delete': {
    access: 'manager',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      const reason = requireText(params.reason, 'اكتب سبب الحذف.');

      if (String(params.confirm ?? '') !== target.label) {
        throw new HttpError(400, 'اكتب اسم رابط العميل كما هو لتأكيد الحذف النهائي.');
      }

      await pool.query('delete from users where id = $1', [target.id]);
      await audit(staff, 'user.delete', target, { reason });
      return { ok: true };
    },
  },

  // DOMAIN-01/02, PERM-06: approval and execution by the manager or an
  // authorised employee, only after the fee was paid.
  'subdomain.change': {
    access: 'staff',
    permission: 'change_subdomain',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);

      if (params.paymentConfirmed !== true) {
        throw new HttpError(400, 'لا يُنفَّذ التغيير قبل تأكيد سداد رسوم تغيير الرابط.');
      }

      const availability = await getUsernameAvailability(String(params.username ?? ''));

      if (!availability.available) {
        throw new HttpError(409, availability.reason ?? 'الاسم غير متاح.');
      }

      const client = await pool.connect();
      let oldUsername = '';

      try {
        await client.query('begin');

        const current = await client.query<{ username: string }>(
          'select username from usernames where user_id = $1 for update',
          [target.id],
        );

        oldUsername = current.rows[0]?.username ?? '';

        if (!oldUsername) {
          // NEW-01 (amended): before the payment the name is only held, and the
          // customer changes it themselves at no charge.
          throw new HttpError(409, 'اسم هذا العميل لم يُثبَّت بعد (لم يدفع)؛ يغيّره العميل نفسه من لوحته قبل الدفع.');
        }

        await client.query('update usernames set username = $2 where user_id = $1', [target.id, availability.normalized]);

        // A name this customer left earlier may be the one they return to.
        await client.query('delete from username_redirects where old_username = $1', [availability.normalized]);

        await client.query(
          `insert into username_redirects (old_username, user_id, expires_at)
           values ($1, $2, now() + make_interval(days => $3))
           on conflict (old_username) do update set user_id = excluded.user_id, expires_at = excluded.expires_at`,
          [oldUsername, target.id, REDIRECT_DAYS],
        );

        await client.query('commit');
      } catch (error: any) {
        await client.query('rollback');

        if (error?.code === '23505') {
          throw new HttpError(409, 'هذا الاسم حُجز للتو. اختر اسمًا آخر.');
        }

        throw error;
      } finally {
        client.release();
      }

      await audit(staff, 'subdomain.change', { ...target, label: availability.normalized }, {
        from: oldUsername,
        to: availability.normalized,
        redirectDays: REDIRECT_DAYS,
      });

      return { username: availability.normalized };
    },
  },

  // PERM-01 / MOD-03: an employee removes violating content by hand.
  'content.removeLink': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);

      const linkId = String(params.linkId ?? '');
      const page = await pool.query<{ id: string }>('select id from pages where user_id = $1', [target.id]);

      // Kept in the archive so the manager can restore it (PERM-19).
      if (page.rows[0] && /^[0-9a-f-]{36}$/i.test(linkId)) {
        await archiveLinks(pool, page.rows[0].id, [linkId], staff.name);
      }

      const result = await pool.query<{ title: string }>(
        `delete from page_links
         where id = $2 and page_id = (select id from pages where user_id = $1)
         returning title`,
        [target.id, linkId],
      );

      if (!result.rowCount) {
        throw new HttpError(404, 'الزر غير موجود.');
      }

      await audit(staff, 'content.removeLink', target, { title: result.rows[0].title });
      return { ok: true };
    },
  },

  'content.clear': {
    access: 'staff',
    run: async (params, staff) => {
      const target = await customerTarget(params.userId);
      const updates: Record<string, string> = {
        name: "display_name = ''",
        bio: "bio = ''",
        profileImage: "profile_image_url = ''",
        wallpaper: `wallpaper_json = '{"type":"color","value":"#ffffff"}'::jsonb`,
      };

      const update = updates[String(params.field ?? '')];

      if (!update) {
        throw new HttpError(400, 'حقل غير معروف.');
      }

      await pool.query(`update pages set ${update}, updated_at = now() where user_id = $1`, [target.id]);
      await audit(staff, 'content.clear', target, { field: params.field });
      return { ok: true };
    },
  },

  // ---- Review queue (MOD-01..04, AC-04) -------------------------------------

  'reviews.list': {
    access: 'staff',
    run: async (params) => {
      const status = ['pending', 'accepted', 'rejected'].includes(params.status) ? params.status : 'pending';

      const result = await pool.query(
        `
          select r.id, r.status, r.reason, r.reviewed_by, r.reviewed_at, r.created_at, r.snapshot_json,
                 p.user_id, un.username
          from content_reviews r
          join pages p on p.id = r.page_id
          left join customer_names un on un.user_id = p.user_id
          where r.status = $1
          order by r.created_at desc
          limit 100
        `,
        [status],
      );

      return { reviews: result.rows };
    },
  },

  // Rejecting records the decision and tells the beneficiary why; it deletes
  // nothing — removal is a separate manual step (MOD-03).
  'reviews.decide': {
    access: 'staff',
    run: async (params, staff) => {
      const decision = params.decision === 'rejected' ? 'rejected' : params.decision === 'accepted' ? 'accepted' : null;

      if (!decision) {
        throw new HttpError(400, 'القرار يجب أن يكون مقبول أو مرفوض.');
      }

      const reason = decision === 'rejected' ? requireText(params.reason, 'اكتب سبب الرفض.') : null;

      const result = await pool.query<{ user_id: string; email: string | null }>(
        `
          update content_reviews r
          set status = $2, reason = $3, reviewed_by = $4, reviewed_at = now()
          from pages p join users u on u.id = p.user_id
          where r.id = $1 and p.id = r.page_id and r.status = 'pending'
          returning p.user_id, u.email
        `,
        [String(params.id ?? ''), decision, reason, staff.name],
      );

      const row = result.rows[0];

      if (!row) {
        throw new HttpError(409, 'هذه المراجعة غير موجودة أو تم البت فيها.');
      }

      // An accepted save also settles the customer's older pending saves: the
      // newest one is what is live.
      if (decision === 'accepted') {
        await pool.query(
          `update content_reviews set status = 'accepted', reviewed_by = $2, reviewed_at = now()
           where status = 'pending' and page_id = (select page_id from content_reviews where id = $1)
             and created_at < (select created_at from content_reviews where id = $1)`,
          [String(params.id), staff.name],
        );
      }

      let notified = false;

      if (decision === 'rejected' && row.email) {
        notified = await sendNoticeEmail(row.email, 'ملاحظة على محتوى صفحتك في عنوان', [
          'راجع فريق عنوان آخر تعديل على صفحتك ووجد ما يخالف شروط الاستخدام.',
          `السبب: ${reason}`,
          'نرجو تعديل المحتوى من لوحة التحكم.',
        ]);
      }

      await audit(staff, `review.${decision}`, { type: 'customer', id: row.user_id, label: await getCustomerLabel(row.user_id) }, {
        reviewId: params.id,
        reason,
        notified,
      });

      return { ok: true, notified };
    },
  },

  // ---- Public reports (PUB-03, PERM-16) -------------------------------------

  'reports.list': {
    access: 'staff',
    run: async (params) => {
      const result = await pool.query(
        `
          select r.id, r.username, r.message, r.created_at, r.handled_at, r.handled_by, p.user_id
          from page_reports r
          left join pages p on p.id = r.page_id
          where ($1::boolean or r.handled_at is null)
          order by r.created_at desc
          limit 200
        `,
        [params.includeHandled === true],
      );

      return { reports: result.rows };
    },
  },

  'reports.handle': {
    access: 'staff',
    run: async (params, staff) => {
      const result = await pool.query<{ username: string }>(
        'update page_reports set handled_at = now(), handled_by = $2 where id = $1 and handled_at is null returning username',
        [String(params.id ?? ''), staff.name],
      );

      if (!result.rowCount) {
        throw new HttpError(409, 'البلاغ غير موجود أو عولج سابقًا.');
      }

      await audit(staff, 'report.handle', { type: 'report', id: String(params.id), label: result.rows[0].username });
      return { ok: true };
    },
  },

  // ---- Beneficiary requests (REQ-01..03) ------------------------------------

  'requests.list': {
    access: 'staff',
    run: async (params) => {
      // REQ-02: a dated request that passed its date unfinished is stalled.
      await pool.query(
        "update support_requests set status = 'stalled', updated_at = now() where status = 'in_progress' and due_at < now()",
      );

      const status = ['in_progress', 'completed', 'stalled'].includes(params.status) ? params.status : null;

      const result = await pool.query(
        `
          select r.id, r.type, r.message, r.status, r.due_at, r.internal_notes, r.handled_by, r.created_at,
                 r.user_id, u.email, u.phone, un.username
          from support_requests r
          join users u on u.id = r.user_id
          left join customer_names un on un.user_id = r.user_id
          where ($1::text is null or r.status = $1)
          order by r.created_at desc
          limit 200
        `,
        [status],
      );

      return { requests: result.rows };
    },
  },

  'requests.update': {
    access: 'staff',
    run: async (params, staff) => {
      const status = String(params.status ?? '');

      if (!['in_progress', 'completed', 'stalled'].includes(status)) {
        throw new HttpError(400, 'حالة الطلب غير معروفة.');
      }

      const dueAt = params.dueAt ? new Date(String(params.dueAt)) : null;

      if (dueAt && Number.isNaN(dueAt.getTime())) {
        throw new HttpError(400, 'الموعد المستهدف غير صالح.');
      }

      const result = await pool.query<{ user_id: string; type: string }>(
        `update support_requests
         set status = $2, due_at = $3, internal_notes = $4, handled_by = $5, updated_at = now()
         where id = $1 returning user_id, type`,
        [String(params.id ?? ''), status, dueAt, String(params.internalNotes ?? '').trim() || null, staff.name],
      );

      const row = result.rows[0];

      if (!row) {
        throw new HttpError(404, 'الطلب غير موجود.');
      }

      await audit(staff, 'request.update', { type: 'customer', id: row.user_id, label: await getCustomerLabel(row.user_id) }, {
        requestType: row.type,
        status,
        dueAt,
      });

      return { ok: true };
    },
  },

  // ---- Prices (PAY-01, PERM-08) ---------------------------------------------

  'plans.list': { access: 'staff', run: async () => ({ plans: await getPlans() }) },

  'plans.set': {
    access: 'manager',
    run: async (params, staff) => {
      const price = Number(params.priceSar);

      if (!isPlan(params.plan) || !Number.isFinite(price) || price <= 0 || price > 100000) {
        throw new HttpError(400, 'أدخل سعرًا صحيحًا بالريال.');
      }

      await pool.query('update plans set price_sar = $2, updated_at = now() where plan = $1', [params.plan, price]);
      await audit(staff, 'plans.set', { type: 'plan', id: params.plan, label: params.plan }, { priceSar: price });

      return { plans: await getPlans() };
    },
  },

  // PAY-02: general discount on a plan, until the manager removes it (null).
  'plans.setDiscount': {
    access: 'manager',
    run: async (params, staff) => {
      const percent = params.percent === null || params.percent === '' ? null : Number(params.percent);

      if (!isPlan(params.plan) || (percent !== null && (!Number.isFinite(percent) || percent <= 0 || percent >= 100))) {
        throw new HttpError(400, 'أدخل نسبة خصم بين 1 و99، أو اتركها فارغة لإيقاف الخصم.');
      }

      await pool.query('update plans set discount_percent = $2, updated_at = now() where plan = $1', [params.plan, percent]);
      await audit(staff, 'plans.setDiscount', { type: 'plan', id: params.plan, label: params.plan }, { percent });

      return { plans: await getPlans() };
    },
  },

  // PAY-03: discount codes with an expiry date and a usage limit.
  'codes.list': {
    access: 'manager',
    run: async () => {
      const result = await pool.query(
        'select code, kind, value::float, expires_at, max_uses, used_count, is_active, created_at from discount_codes order by created_at desc',
      );

      return { codes: result.rows };
    },
  },

  'codes.create': {
    access: 'manager',
    run: async (params, staff) => {
      const code = normalizeDiscountCode(params.code);
      const kind = params.kind === 'amount' ? 'amount' : 'percent';
      const value = Number(params.value);
      const maxUses = params.maxUses === null || params.maxUses === '' || params.maxUses === undefined ? null : Math.floor(Number(params.maxUses));
      const expiresAt = params.expiresAt ? new Date(String(params.expiresAt)) : null;

      if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new HttpError(400, 'الكود من 3 إلى 40 حرفًا إنجليزيًا أو رقمًا.');
      if (!Number.isFinite(value) || value <= 0 || (kind === 'percent' && value > 100)) throw new HttpError(400, 'قيمة الخصم غير صحيحة.');
      if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) throw new HttpError(400, 'حد الاستخدام غير صحيح.');
      if (expiresAt && Number.isNaN(expiresAt.getTime())) throw new HttpError(400, 'تاريخ الانتهاء غير صحيح.');

      try {
        await pool.query(
          'insert into discount_codes (code, kind, value, expires_at, max_uses) values ($1, $2, $3, $4, $5)',
          [code, kind, value, expiresAt, maxUses],
        );
      } catch (error: any) {
        if (error?.code === '23505') throw new HttpError(409, 'هذا الكود موجود.');
        throw error;
      }

      await audit(staff, 'codes.create', { type: 'code', id: code, label: code }, { kind, value, maxUses, expiresAt });
      return { ok: true };
    },
  },

  'codes.setActive': {
    access: 'manager',
    run: async (params, staff) => {
      const code = normalizeDiscountCode(params.code);
      const result = await pool.query('update discount_codes set is_active = $2 where code = $1', [code, params.isActive === true]);

      if (!result.rowCount) throw new HttpError(404, 'الكود غير موجود.');

      await audit(staff, 'codes.setActive', { type: 'code', id: code, label: code }, { isActive: params.isActive === true });
      return { ok: true };
    },
  },

  // ---- Staff (PERM-18) and audit log (PERM-15): manager only ---------------

  'staff.list': {
    access: 'manager',
    run: async () => {
      const result = await pool.query<Staff>('select * from staff order by created_at asc');
      return { staff: result.rows.map(publicStaff), grantable: GRANTABLE_PERMISSIONS };
    },
  },

  'staff.create': {
    access: 'manager',
    run: async (params, staff) => {
      const email = normalizeEmail(params.email);
      const name = requireText(params.name, 'اسم الموظف مطلوب.', 2);
      const password = String(params.password ?? '');
      const passwordError = validatePassword(password);

      if (!isValidEmail(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح.');
      if (passwordError) throw new HttpError(400, passwordError);

      try {
        const result = await pool.query<Staff>(
          `insert into staff (email, name, password_hash, role) values ($1, $2, $3, 'staff') returning *`,
          [email, name, hashPassword(password)],
        );

        await audit(staff, 'staff.create', { type: 'staff', id: result.rows[0].id, label: name });
        return { staff: publicStaff(result.rows[0]) };
      } catch (error: any) {
        if (error?.code === '23505') {
          throw new HttpError(409, 'يوجد موظف بهذا البريد.');
        }

        throw error;
      }
    },
  },

  'staff.update': {
    access: 'manager',
    run: async (params, staff) => {
      const id = String(params.id ?? '');
      const changes: string[] = [];
      const values: unknown[] = [id];
      const logged: Record<string, unknown> = {};

      if (typeof params.isActive === 'boolean') {
        // The manager cannot lock the administration out of its own panel.
        if (id === staff.id && !params.isActive) {
          throw new HttpError(400, 'لا يمكنك إيقاف حسابك.');
        }

        values.push(params.isActive);
        changes.push(`is_active = $${values.length}`);
        logged.isActive = params.isActive;
      }

      if (Array.isArray(params.permissions)) {
        const permissions = params.permissions.filter((permission: unknown) =>
          GRANTABLE_PERMISSIONS.includes(String(permission)),
        );

        values.push(JSON.stringify(permissions));
        changes.push(`permissions = $${values.length}::jsonb`);
        logged.permissions = permissions;
      }

      if (params.password) {
        const passwordError = validatePassword(String(params.password));
        if (passwordError) throw new HttpError(400, passwordError);

        values.push(hashPassword(String(params.password)));
        changes.push(`password_hash = $${values.length}`);
        logged.passwordReset = true;
      }

      if (!changes.length) {
        throw new HttpError(400, 'لا يوجد تغيير.');
      }

      const result = await pool.query<Staff>(
        `update staff set ${changes.join(', ')}, updated_at = now() where id = $1 returning *`,
        values,
      );

      if (!result.rows[0]) {
        throw new HttpError(404, 'الموظف غير موجود.');
      }

      await audit(staff, 'staff.update', { type: 'staff', id, label: result.rows[0].name }, logged);
      return { staff: publicStaff(result.rows[0]) };
    },
  },

  'audit.list': {
    access: 'manager',
    run: async () => {
      const result = await pool.query(
        `select id, staff_name, action, target_type, target_id, target_label, details, created_at
         from audit_log order by created_at desc limit 300`,
      );

      return { entries: result.rows };
    },
  },
};

// Base URL for links sent to people (payment link, set-password link).
export function getOrigin(req: any) {
  const origin = String(req.headers?.origin ?? '');

  return /^https?:\/\/[^\s/]+$/.test(origin) ? origin : `https://${getEnv('ROOT_DOMAIN') || 'onwan.link'}`;
}

// Loads the employee on every request so deactivation is immediate.
async function loadStaff(req: any): Promise<Staff> {
  const session = verifySessionToken(getBearerToken(req));

  if (!session || session.kind !== 'staff') {
    throw new HttpError(401, 'انتهت الجلسة. سجّل الدخول من جديد.');
  }

  const result = await pool.query<Staff>('select * from staff where id = $1 limit 1', [session.userId]);
  const staff = result.rows[0];

  if (!staff || !staff.is_active) {
    throw new HttpError(401, 'انتهت الجلسة. سجّل الدخول من جديد.');
  }

  return staff;
}

// The single place where the permissions matrix is enforced.
export async function runAdminAction(req: any, action: string, params: any) {
  const handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;
  const context: AdminContext = { origin: getOrigin(req) };

  if (!handler) {
    throw new HttpError(400, 'إجراء غير معروف.');
  }

  if (handler.access === 'public') {
    return handler.run(params, null as unknown as Staff, context);
  }

  const staff = await loadStaff(req);
  const isManager = staff.role === 'manager';

  if (handler.access === 'manager' && !isManager) {
    throw new HttpError(403, 'هذا الإجراء لمدير عنوان فقط.');
  }

  if (handler.permission && !isManager && !(staff.permissions ?? []).includes(handler.permission)) {
    throw new HttpError(403, 'لست مخوّلًا بهذا الإجراء. اطلب التخويل من المدير.');
  }

  return handler.run(params, staff, context);
}
