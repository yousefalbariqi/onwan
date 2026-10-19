import { getEnv } from './runtime.js';
import { getAccountSummary, getPlans, isPlan, pricePlan, isValidEmail, isValidPhone, normalizeEmail, normalizePhone, requestSubscription } from './account.js';
import { pool } from './db.js';
import { sendAdminEmail } from './email.js';
import { HttpError } from './http.js';
import { consumeCode, issueCode } from './otp.js';
import { getVisitStats } from './page.js';
import { hashPassword, validatePassword } from './password.js';
import { getDesignPrice, getLatestDesignPackage, getSettings, isPackageOpen } from './services.js';
import { reserveUsername } from './username.js';
import { checkDns, dnsInstruction, normalizeDomain } from './domains.js';
import type { SessionUser } from './session.js';

type Handler = (params: any, user: SessionUser) => Promise<unknown>;

// What the beneficiary may ask the administration for. Each one is a request
// only — execution stays with the administration (PAGE-13, PAGE-14,
// DOMAIN-01, SUB-05, FILE-03, PAY-05).
const REQUEST_TYPES: Record<string, string> = {
  message: 'رسالة للإدارة',
  pause_page: 'طلب إيقاف الصفحة',
  reactivate_page: 'طلب إعادة تفعيل الصفحة',
  delete_account: 'طلب حذف الحساب',
  change_subdomain: 'طلب تغيير رابط الصفحة',
  stop_renewal: 'طلب إيقاف التجديد',
  more_storage: 'طلب زيادة المساحة',
  invoice: 'طلب فاتورة',
};

function requireEmail(user: SessionUser) {
  if (!user.email) {
    throw new HttpError(400, 'لا يوجد بريد إلكتروني مسجل لهذا الحساب. تواصل مع الإدارة.');
  }

  return user.email;
}

// ACCT-05: every change of email, phone or password needs a code sent to the
// registered email.
async function requireChangeCode(user: SessionUser, code: unknown) {
  if (!(await consumeCode(requireEmail(user), 'account_change', String(code ?? '')))) {
    throw new HttpError(401, 'الرمز غير صحيح أو منتهي الصلاحية.');
  }
}

function text(value: unknown, message: string, min: number, max: number) {
  const result = String(value ?? '').trim();

  if (result.length < min || result.length > max) {
    throw new HttpError(400, message);
  }

  return result;
}

const handlers: Record<string, Handler> = {
  // PAGE-12 / REQ-01: saved for the administration panel, with a copy by email.
  // The internal status is never returned to the beneficiary (REQ-03).
  'request.send': async (params, user) => {
    const type = String(params.type ?? '');

    if (!REQUEST_TYPES[type]) {
      throw new HttpError(400, 'نوع الطلب غير معروف.');
    }

    const message = text(params.message, 'اكتب تفاصيل الطلب (حتى 4000 حرف).', 3, 4000);

    await pool.query('insert into support_requests (user_id, type, message) values ($1, $2, $3)', [user.id, type, message]);

    await sendAdminEmail(`${REQUEST_TYPES[type]} — ${user.email ?? user.phone}`, [
      `النوع: ${REQUEST_TYPES[type]}`,
      `البريد: ${user.email ?? '—'}`,
      `الجوال: ${user.phone}`,
      `التفاصيل: ${message}`,
    ]);

    return { message: 'تم استلام طلبك وسيتواصل معك فريق عنوان.' };
  },

  // Everything the «الحساب» tab shows besides the account itself.
  overview: async (_params, user) => {
    const [settings, pkg, orders, stats, domain] = await Promise.all([
      getSettings(),
      getLatestDesignPackage(user.id),
      pool.query(
        `select order_number, quantity, total::float, status, created_at
         from nfc_orders where user_id = $1 order by created_at desc limit 20`,
        [user.id],
      ),
      getVisitStats(user.id),
      pool.query("select domain, status, price::float from custom_domains where user_id = $1 and status <> 'removed'", [user.id]),
    ]);

    return {
      stats,
      design: {
        priceSar: getDesignPrice(),
        canPurchase: !isPackageOpen(pkg),
        // NEW-06: requested → in progress → done at the design's approval.
        package: pkg
          ? {
              state: pkg.status === 'pending_payment' ? 'pending_payment' : pkg.design_approved_at ? 'done' : 'in_progress',
              approvedAt: pkg.design_approved_at,
            }
          : null,
      },
      // DOMAIN-03: the page on the entity's own domain.
      domain: {
        priceSar: settings.custom_domain_price,
        current: domain.rows[0]
          ? { ...domain.rows[0], instruction: dnsInstruction(domain.rows[0].domain) }
          : null,
      },
      nfc: {
        unitPrice: settings.nfc_unit_price,
        shippingPrice: settings.nfc_shipping_price,
        orders: orders.rows,
      },
    };
  },

  // DES-01/02: the request is registered with the administration; the design
  // and its approval then happen over WhatsApp.
  'design.request': async (_params, user) => {
    if (isPackageOpen(await getLatestDesignPackage(user.id))) {
      throw new HttpError(409, 'لديك طلب «صمّم لي» قائم لم ينتهِ بعد.');
    }

    await pool.query('insert into design_packages (user_id, price) values ($1, $2)', [user.id, getDesignPrice()]);

    await sendAdminEmail(`طلب «صمّم لي» — ${user.email ?? user.phone}`, [
      `البريد: ${user.email ?? '—'}`,
      `الجوال: ${user.phone}`,
    ]);

    return { message: 'سُجّل طلب «صمّم لي». سيتواصل معك فريق عنوان عبر واتساب لإتمام الدفع وبدء التصميم.' };
  },

  // NFC-02: any quantity; the total and the shipping are shown before payment
  // and frozen into the order. AC-13: nothing is prepared before the payment
  // is confirmed.
  'nfc.create': async (params, user) => {
    const settings = await getSettings();

    if (settings.nfc_unit_price === null || settings.nfc_shipping_price === null) {
      throw new HttpError(409, 'لم يُحدد سعر قطع NFC بعد.');
    }

    const quantity = Math.floor(Number(params.quantity));

    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100000) {
      throw new HttpError(400, 'أدخل عدد القطع.');
    }

    const recipientName = text(params.recipientName, 'اسم المستلم مطلوب.', 2, 160);
    const city = text(params.city, 'المدينة مطلوبة.', 2, 80);
    const address = text(params.address, 'عنوان الشحن مطلوب.', 5, 500);
    const phone = normalizePhone(params.recipientPhone);

    if (!isValidPhone(phone)) {
      throw new HttpError(400, 'جوال المستلم غير صالح.');
    }

    // Ordering on its own is for a customer whose address is already fixed;
    // before the first payment the pieces go in the registration cart.
    const username = await pool.query<{ username: string }>('select username from usernames where user_id = $1', [user.id]);

    if (!username.rows[0]) {
      throw new HttpError(409, 'أضف قطع NFC من سلة التسجيل؛ الطلب المستقل متاح بعد إتمام الاشتراك.');
    }

    const total = Math.round((quantity * settings.nfc_unit_price + settings.nfc_shipping_price) * 100) / 100;

    const result = await pool.query<{ order_number: number }>(
      `insert into nfc_orders
         (user_id, quantity, unit_price, shipping_price, total, recipient_name, recipient_phone, city, address, page_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning order_number`,
      [
        user.id,
        quantity,
        settings.nfc_unit_price,
        settings.nfc_shipping_price,
        total,
        recipientName,
        phone,
        city,
        address,
        `https://${username.rows[0].username}.${getEnv('ROOT_DOMAIN') || 'onwan.link'}`,
      ],
    );

    await sendAdminEmail(`طلب NFC #${result.rows[0].order_number}`, [
      `العميل: ${user.email ?? user.phone}`,
      `العدد: ${quantity} — الإجمالي: ${total} ريال`,
      `المستلم: ${recipientName} — ${phone}`,
      `العنوان: ${city} — ${address}`,
    ]);

    return { orderNumber: result.rows[0].order_number, total };
  },

  // NEW-01 (amended): until the payment the name is only held, and may be
  // changed — which releases the previous hold.
  'name.change': async (params, user) => {
    const fixed = await pool.query('select 1 from usernames where user_id = $1', [user.id]);

    if (fixed.rowCount) {
      throw new HttpError(409, 'اسم الرابط مثبّت بعد الدفع. لتغييره أرسل طلب «تغيير رابط الصفحة» للإدارة.');
    }

    const username = await reserveUsername(pool, user.id, String(params.username ?? ''));

    return { username, account: await getAccountSummary(user.id) };
  },

  // NEW-04 / NEW-05: everything the registration cart and its summary need.
  'cart.quote': async (_params, user) => {
    const [plans, settings, pkg, cart, account] = await Promise.all([
      getPlans(),
      getSettings(),
      getLatestDesignPackage(user.id),
      pool.query(
        `select cart_number, plan, plan_price::float, design_price::float, nfc_quantity, nfc_unit_price::float,
                nfc_shipping_price::float, nfc_recipient_name, nfc_recipient_phone, nfc_city, nfc_address, total::float,
                discount_code, custom_domain, domain_price::float
         from registration_carts where user_id = $1 and status = 'pending_payment'`,
        [user.id],
      ),
      getAccountSummary(user.id),
    ]);

    return {
      plans,
      designPriceSar: getDesignPrice(),
      designAvailable: !isPackageOpen(pkg),
      nfcUnitPrice: settings.nfc_unit_price,
      nfcShippingPrice: settings.nfc_shipping_price,
      domainPriceSar: settings.custom_domain_price,
      cart: cart.rows[0] ?? null,
      account,
    };
  },

  // PAY-03: lets the cart show what a code does before the cart is sent.
  'cart.checkCode': async (params, user) => {
    if (!isPlan(params.plan)) {
      throw new HttpError(400, 'اختر الاشتراك أولًا.');
    }

    const pricing = await pricePlan(params.plan, params.code, user.id);

    if (!pricing) throw new HttpError(409, 'لم يُحدد سعر هذا الاشتراك بعد.');
    if (pricing.codeError) throw new HttpError(400, pricing.codeError);

    return { pricing };
  },

  // The cart is priced here, on the server, from the current prices; the
  // total is frozen so the summary the customer approved is what is collected.
  // It never marks anything as paid (SUB-02).
  'cart.submit': async (params, user) => {
    if (!isPlan(params.plan)) {
      throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
    }

    // A hold that expired and was taken by someone else leaves no name to pay for.
    const name = await pool.query('select 1 from customer_names where user_id = $1 and username is not null', [user.id]);

    if (!name.rowCount) {
      throw new HttpError(409, 'انتهى حجز اسم الرابط. اختر اسمًا جديدًا من تبويب «الحساب» ثم أكمل السلة.');
    }

    const [pricing, settings] = await Promise.all([pricePlan(params.plan, params.code, user.id), getSettings()]);

    if (!pricing) {
      throw new HttpError(409, 'لم يُحدد سعر هذا الاشتراك بعد.');
    }

    // The customer must not pay a total that silently lost its discount.
    if (pricing.codeError) {
      throw new HttpError(400, pricing.codeError);
    }

    const planPrice = pricing.finalPrice;

    let designPrice: number | null = null;

    if (params.design === true) {
      designPrice = getDesignPrice();

      if (designPrice === null) throw new HttpError(409, 'لم يُحدد سعر «صمّم لي» بعد.');
      if (isPackageOpen(await getLatestDesignPackage(user.id))) throw new HttpError(409, 'لديك طلب «صمّم لي» قائم.');
    }

    const quantity = Math.max(0, Math.floor(Number(params.nfcQuantity) || 0));
    let nfc: { unit: number; shipping: number; name: string; phone: string; city: string; address: string } | null = null;

    if (quantity > 0) {
      if (settings.nfc_unit_price === null || settings.nfc_shipping_price === null) {
        throw new HttpError(409, 'لم يُحدد سعر قطع NFC بعد.');
      }

      const phone = normalizePhone(params.nfcRecipientPhone);

      if (quantity > 100000) throw new HttpError(400, 'عدد القطع غير صحيح.');
      if (!isValidPhone(phone)) throw new HttpError(400, 'جوال مستلم قطع NFC غير صالح.');

      nfc = {
        unit: settings.nfc_unit_price,
        shipping: settings.nfc_shipping_price,
        name: text(params.nfcRecipientName, 'اسم مستلم قطع NFC مطلوب.', 2, 160),
        phone,
        city: text(params.nfcCity, 'مدينة الشحن مطلوبة.', 2, 80),
        address: text(params.nfcAddress, 'عنوان الشحن مطلوب.', 5, 500),
      };
    }

    // DOMAIN-03 in the cart: bought now, connected after the payment.
    let customDomain: string | null = null;
    let domainPrice: number | null = null;

    if (String(params.domain ?? '').trim()) {
      domainPrice = settings.custom_domain_price;

      if (domainPrice === null) throw new HttpError(409, 'خدمة الدومين الخاص غير متاحة بعد.');

      customDomain = normalizeDomain(params.domain);

      const taken = await pool.query("select 1 from custom_domains where domain = $1 and status <> 'removed'", [customDomain]);

      if (taken.rowCount) throw new HttpError(409, 'هذا الدومين مسجّل لصفحة أخرى.');
    }

    const total =
      Math.round((planPrice + (designPrice ?? 0) + (nfc ? quantity * nfc.unit + nfc.shipping : 0) + (domainPrice ?? 0)) * 100) / 100;

    await requestSubscription(user.id, params.plan);

    const result = await pool.query<{ cart_number: number }>(
      `
        insert into registration_carts
          (user_id, plan, plan_price, design_price, nfc_quantity, nfc_unit_price, nfc_shipping_price,
           nfc_recipient_name, nfc_recipient_phone, nfc_city, nfc_address, total,
           plan_list_price, general_discount, discount_code, code_discount, custom_domain, domain_price)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        on conflict (user_id) where status = 'pending_payment' do update set
          plan = excluded.plan, plan_price = excluded.plan_price, design_price = excluded.design_price,
          nfc_quantity = excluded.nfc_quantity, nfc_unit_price = excluded.nfc_unit_price,
          nfc_shipping_price = excluded.nfc_shipping_price, nfc_recipient_name = excluded.nfc_recipient_name,
          nfc_recipient_phone = excluded.nfc_recipient_phone, nfc_city = excluded.nfc_city,
          nfc_address = excluded.nfc_address, total = excluded.total, created_at = now(),
          plan_list_price = excluded.plan_list_price, general_discount = excluded.general_discount,
          discount_code = excluded.discount_code, code_discount = excluded.code_discount,
          custom_domain = excluded.custom_domain, domain_price = excluded.domain_price
        returning cart_number
      `,
      [
        user.id,
        params.plan,
        planPrice,
        designPrice,
        quantity,
        nfc?.unit ?? null,
        nfc?.shipping ?? null,
        nfc?.name ?? null,
        nfc?.phone ?? null,
        nfc?.city ?? null,
        nfc?.address ?? null,
        total,
        pricing.listPrice,
        pricing.generalDiscount,
        pricing.code,
        pricing.codeDiscount,
        customDomain,
        domainPrice,
      ],
    );

    await sendAdminEmail(`سلة تسجيل #${result.rows[0].cart_number} بانتظار الدفع`, [
      `العميل: ${user.email ?? user.phone}`,
      `الاشتراك: ${params.plan === 'annual' ? 'سنوي' : 'شهري'}${designPrice !== null ? ' + صمّم لي' : ''}${nfc ? ` + ${quantity} قطعة NFC` : ''}${customDomain ? ` + دومين ${customDomain}` : ''}`,
      `الإجمالي: ${total} ريال`,
    ]);

    // The gateway is not chosen yet (P-08): no checkout URL, payment is
    // confirmed by the administration.
    return { cartNumber: result.rows[0].cart_number, total, checkoutUrl: null, paymentConfigured: false };
  },

  // SUB-05 / PAY-01: a renewal invoice never extends the subscription by
  // itself. The future payment webhook (or staff confirmation) must do that.
  'renewal.quote': async (_params, user) => {
    const [account, plans] = await Promise.all([getAccountSummary(user.id), getPlans()]);

    if (!account?.subscription) {
      throw new HttpError(409, 'لا يوجد اشتراك يمكن تجديده لهذا الحساب.');
    }

    return { account, plans };
  },

  'renewal.submit': async (params, user) => {
    if (!isPlan(params.plan)) {
      throw new HttpError(400, 'اختر الاشتراك الشهري أو السنوي.');
    }

    const [subscription, plans] = await Promise.all([
      pool.query<{ expires_at: string | null }>('select expires_at from subscriptions where user_id = $1', [user.id]),
      getPlans(),
    ]);
    const selectedPlan = plans.find((item) => item.plan === params.plan);

    if (!subscription.rows[0]) {
      throw new HttpError(409, 'لا يوجد اشتراك يمكن تجديده لهذا الحساب.');
    }
    if (!selectedPlan || selectedPlan.priceSar === null) {
      throw new HttpError(409, 'لم يُحدد سعر هذا الاشتراك بعد.');
    }

    const result = await pool.query<{ invoice_number: number; amount: string }>(
      `insert into subscription_renewals (user_id, plan, amount, due_at)
       values ($1, $2, $3, $4)
       on conflict (user_id) where status = 'pending_payment' do update set
         plan = excluded.plan, amount = excluded.amount, due_at = excluded.due_at, created_at = now()
       returning invoice_number, amount`,
      [user.id, params.plan, selectedPlan.priceSar, subscription.rows[0].expires_at],
    );

    const invoice = result.rows[0];
    return {
      invoiceNumber: invoice.invoice_number,
      total: Number(invoice.amount),
      checkoutUrl: null,
      paymentConfigured: false,
      account: await getAccountSummary(user.id),
    };
  },

  // DOMAIN-03: request the page on a domain the entity owns. The fee is
  // frozen in the request; nothing is served before payment and DNS proof.
  'domain.request': async (params, user) => {
    const price = (await getSettings()).custom_domain_price;

    if (price === null) throw new HttpError(409, 'خدمة الدومين الخاص غير متاحة بعد.');

    const fixed = await pool.query('select 1 from usernames where user_id = $1', [user.id]);

    if (!fixed.rowCount) throw new HttpError(409, 'الدومين الخاص متاح بعد إتمام الاشتراك.');

    const domain = normalizeDomain(params.domain);

    try {
      await pool.query('insert into custom_domains (user_id, domain, price) values ($1, $2, $3)', [user.id, domain, price]);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new HttpError(409, 'لديك طلب دومين قائم، أو أن هذا الدومين مسجّل لصفحة أخرى.');
      }

      throw error;
    }

    await sendAdminEmail(`طلب دومين خاص: ${domain}`, [`العميل: ${user.email ?? user.phone}`, `الرسوم: ${price} ريال`]);

    return { message: 'سُجّل الطلب. بعد تأكيد الدفع تظهر لك هنا خطوة ربط الدومين.' };
  },

  // The customer added the DNS record and asks us to look.
  'domain.verify': async (_params, user) => {
    const result = await pool.query<{ id: string; domain: string }>(
      "select id, domain from custom_domains where user_id = $1 and status = 'awaiting_dns'",
      [user.id],
    );

    const row = result.rows[0];

    if (!row) throw new HttpError(409, 'لا يوجد دومين بانتظار التحقق.');

    if (!(await checkDns(row.domain))) {
      throw new HttpError(409, 'لم نجد السجل بعد. تأكد من إضافته كما هو، وقد يحتاج انتشاره حتى ساعة.');
    }

    await pool.query("update custom_domains set status = 'dns_verified', verified_at = now() where id = $1", [row.id]);
    await sendAdminEmail(`دومين جاهز للتفعيل: ${row.domain}`, [`العميل: ${user.email ?? user.phone}`]);

    return { message: 'تم التحقق من الدومين. يفعّله فريق عنوان خلال وقت قصير.' };
  },

  'change.sendCode': async (_params, user) => {
    await issueCode(requireEmail(user), 'account_change', 'رمز تعديل بيانات حسابك في عنوان:');
    return { message: 'أرسلنا رمزًا إلى بريدك المسجل.' };
  },

  'change.password': async (params, user) => {
    const password = String(params.password ?? '');
    const passwordError = validatePassword(password);

    if (passwordError) throw new HttpError(400, passwordError);

    await requireChangeCode(user, params.code);
    await pool.query('update users set password_hash = $2, updated_at = now() where id = $1', [user.id, hashPassword(password)]);

    return { message: 'تم تغيير كلمة المرور.' };
  },

  'change.phone': async (params, user) => {
    const phone = normalizePhone(params.phone);

    if (!isValidPhone(phone)) throw new HttpError(400, 'رقم الجوال غير صالح.');

    const taken = await pool.query('select 1 from users where phone = $1 and id <> $2', [phone, user.id]);

    if (taken.rowCount) throw new HttpError(409, 'رقم الجوال مسجل في حساب آخر.');

    await requireChangeCode(user, params.code);
    await pool.query('update users set phone = $2, updated_at = now() where id = $1', [user.id, phone]);

    return { message: 'تم تغيير رقم الجوال.', account: await getAccountSummary(user.id) };
  },

  // Changing the email is two proofs: the code from the current mailbox here,
  // then a code sent to the new one.
  'change.email.start': async (params, user) => {
    const newEmail = normalizeEmail(params.newEmail);

    if (!isValidEmail(newEmail) || newEmail === user.email) {
      throw new HttpError(400, 'أدخل بريدًا إلكترونيًا جديدًا صالحًا.');
    }

    const taken = await pool.query('select 1 from users where email = $1', [newEmail]);

    if (taken.rowCount) throw new HttpError(409, 'هذا البريد مسجل في حساب آخر.');

    await requireChangeCode(user, params.code);
    await pool.query('update users set pending_email = $2 where id = $1', [user.id, newEmail]);
    await issueCode(newEmail, 'new_email', 'رمز تأكيد بريدك الجديد في عنوان:');

    return { message: 'أرسلنا رمزًا إلى البريد الجديد لتأكيد ملكيته.' };
  },

  'change.email.confirm': async (params, user) => {
    const pending = await pool.query<{ pending_email: string | null }>('select pending_email from users where id = $1', [user.id]);
    const newEmail = pending.rows[0]?.pending_email;

    if (!newEmail || !(await consumeCode(newEmail, 'new_email', String(params.code ?? '')))) {
      throw new HttpError(401, 'الرمز غير صحيح أو منتهي الصلاحية.');
    }

    try {
      await pool.query(
        'update users set email = $2, pending_email = null, email_verified_at = now(), updated_at = now() where id = $1',
        [user.id, newEmail],
      );
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new HttpError(409, 'هذا البريد مسجل في حساب آخر.');
      }

      throw error;
    }

    return { message: 'تم تغيير البريد الإلكتروني.', account: await getAccountSummary(user.id) };
  },
};

export async function runAccountAction(action: string, params: any, user: SessionUser) {
  const handler = Object.prototype.hasOwnProperty.call(handlers, action) ? handlers[action] : null;

  if (!handler) {
    throw new HttpError(400, 'إجراء غير معروف.');
  }

  return handler(params, user);
}
