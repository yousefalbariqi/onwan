# نشر عنوان على Cloudflare Workers + Static Assets

المشروع جاهز للتجميع والاختبار محليًا. لم يُنشر بهذه المهمة، ولم تتغير قاعدة Supabase أو جداولها أو بياناتها. يحتاج اختبارًا نهائيًا على حساب Cloudflare بعد إدخال الأسرار وربط DNS.

## ربط Hyperdrive الموجود

الكود يفضّل `env.HYPERDRIVE.connectionString` عند وجود binding اسمه `HYPERDRIVE`؛ لا يفرض TLS إضافيًا على هذا المسار، وHyperdrive يدير اتصال Supabase. بدون binding يستعمل DATABASE_URL كالسابق.

أضف معرّف اتصال Hyperdrive الموجود في `wrangler.jsonc` قبل النشر من CLI، حتى يبقى الربط ضمن إعداد المشروع:

```json
"hyperdrive": [{ "binding": "HYPERDRIVE", "id": "YOUR_EXISTING_HYPERDRIVE_ID" }]
```

المعرّف ليس كلمة مرور. عطّل Query caching لاتصال Hyperdrive لهذا التطبيق حتى تكون فحوص الأسماء والجلسات والصلاحيات مباشرة. ثم أعد النشر. ربط لوحة Cloudflare وحده لا يحدّث الكود المنشور. راجع [pg مع Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-drivers-and-libraries/node-postgres/).

## المتطلبات

- Node.js حديث مدعوم من Wrangler (يفضل Node 22 أو أحدث)، و`npm ci` من مجلد `bio.sa`.
- Worker اسمه `onwan`، ومنطقة `onwan.link` مفعلة في Cloudflare. الإعداد في `wrangler.jsonc`.
- استخدم Workers Paid لتشغيل تسجيل الدخول والتسجيل بتشفير `scrypt` الحالي؛ حد CPU المجاني 10ms قد لا يكفي. بقيت خوارزمية كلمات المرور والجلسات كما هي للمحافظة على الحسابات الحالية. راجع [حدود CPU](https://developers.cloudflare.com/workers/platform/limits/#cpu-time).
- رابط PostgreSQL لنفس قاعدة Supabase الحالية. يمكن استعمال رابط Supabase Transaction Pooler (المنفذ 6543) لنفس قاعدة البيانات؛ لا يلزم Hyperdrive أو D1 أو ترحيل بيانات. احتفظ بكلمة المرور الصحيحة مع ترميز محارفها الخاصة داخل URL، ولا تستخدم `HOST` أو `PASSWORD` حرفيًا.

## متغيرات التشغيل

أدخل الأسرار من Worker → Settings → Variables and Secrets (النوع Secret)، أو `npx wrangler secret put NAME`، الذي يطلب القيمة دون كتابتها في أمر shell. لا ترفع `.env.local` أو `.dev.vars` إلى Git.

| الاسم | مطلوب؟ | الاستخدام |
|---|---|---|
| `DATABASE_URL` | نعم | رابط اتصال قاعدة Supabase/PostgreSQL الحالية |
| `SUPABASE_DATABASE_URL`, `POSTGRES_URL` | بدائل | الأولوية: DATABASE_URL ثم SUPABASE_DATABASE_URL ثم POSTGRES_URL؛ يكفي واحد صحيح |
| `SESSION_SECRET` | نعم | مفتاح توقيع الجلسات؛ نفس القيمة القديمة تحافظ على الجلسات، وتغييره يلغيها |
| `RESEND_API_KEY` | للبريد | إرسال أكواد التأكيد واستعادة كلمة المرور والإشعارات |
| `EMAIL_FROM` | للبريد | مرسل معتمد في Resend |
| `ADMIN_EMAIL` | اختياري | إشعارات الإدارة |
| `SUPPORT_EMAIL` | اختياري | وسيلة التواصل المعروضة للحساب الموقوف |
| `ADMIN_SETUP_TOKEN` | إعداد أول مرة | إنشاء أول مدير عندما جدول الموظفين فارغ؛ أزله بعد الإعداد |
| `DESIGN_SERVICE_PRICE_SAR` | اختياري | سعر «صمّم لي»؛ الافتراضي 43 ريال (قرار المالك 21 أكتوبر 2026) |
| `DEMO_PRICES` | للتجربة فقط | `true` يملأ الأسعار غير المحددة بأسعار تجريبية ظاهرة كذلك؛ لا تفعّله في الإنتاج |
| `CUSTOM_DOMAIN_CNAME_TARGET` | للدومينات المخصصة | هدف CNAME الذي جهّزته في استضافة الدومينات المخصصة؛ الافتراضي على Workers هو onwan.link |
| `CUSTOM_DOMAIN_APEX_IP` | لدومينات العملاء الرئيسية | عنوان الاستضافة الحقيقي عند اعتماد ربطها بسجل A؛ لا توجد قيمة مفترضة لـWorkers |
| `ROOT_DOMAIN` | نعم، مضبوط | موجود في vars بقيمة onwan.link؛ يجب مطابقته مع إعداد البناء أدناه |
| `ASSETS` | ربط تلقائي | binding إلى dist، يضبطه Wrangler؛ ليس سرًا ولا متغيرًا نصيًا |

أسماء `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `SPA_SHELL_URL` تخص مسار Vercel القديم؛ لا يحتاجها Worker ولا يستعملها لربط الدومينات أو قراءة قالب HTML.

متغيرات بناء الواجهة (في بيئة البناء، وليست أسرار Worker):

| الاسم | القيمة/الغرض |
|---|---|
| `VITE_ROOT_DOMAIN` | onwan.link (وهو الافتراضي) |
| `VITE_SUPPORT_WHATSAPP` | رقم دعم اختياري بالأرقام مع رمز الدولة |
| `VITE_SKIP_SIGNUP_USERNAME_CHECK` | false في الإنتاج |
| `VITE_DEMO_PAYMENT` | `false` عند الإطلاق؛ وضع التجربة الحالي قد يفعّل الاشتراك والنشر إذا كان `DEMO_PAYMENT_ENABLED=true` |

أي اسم يبدأ بـ`VITE_` قد يصل للمتصفح؛ لا تضع فيه أسرارًا.

## تشغيل واختبار محلي

```sh
npm ci
cp .dev.vars.example .dev.vars
# عبّئ القيم محليًا، دون نسخ ملف الأسرار إلى dist
npm run dev:worker
```

`dev:worker` يبني الواجهة ثم يشغل Wrangler. `.dev.vars` مخصص لأسرار المحاكي؛ `wrangler secret put` لأسرار الإنتاج. `npm run dev` ما زال يشغّل Vite مع API محلي ويقرأ `.env.local` عبر Vite.

```sh
npm run check:worker
npm run build:worker
npm run test:content
npm run test:worker
```

`build:worker` يبني الواجهة ثم يجمع Worker بـ`--dry-run`؛ لا ينشر. اختبارات Worker تستخدم بيانات PostgreSQL وهمية، ثم تشغّل الحزمة الحقيقية داخل workerd مع ملفات dist الفعلية. لا تتصل بـSupabase ولا ترسل بريدًا حقيقيًا. يلزم بناء dist قبل test:worker على نسخة جديدة.

## نشر الإنتاج

1. تأكد من تطبيق migrations الحالية المطلوبة للنسخة على قاعدة البيانات الموجودة؛ التحويل إلى Workers لا يضيف أي migration. لم تنفذ المهمة أي SQL.
2. سجل الدخول بالحساب الصحيح: `npx wrangler login`.
3. أدخل `DATABASE_URL` و`SESSION_SECRET` وبقية الأسرار المطلوبة بالأسماء أعلاه. لا تعتمد على `.env.local` لإعداد الإنتاج.
4. في DNS أضف سجل `AAAA`، الاسم `*`، القيمة `100::`، مع **Proxied**، لاستخدامه كهدف وهمي لمسار Worker بدون خادم أصل. راجع سجلات الأسماء المحددة مسبقًا التي قد تتجاوز wildcard. لا تغيّر سجلات البريد MX/TXT.
5. `wrangler.jsonc` يربط `onwan.link` كـCustom Domain، و`*.onwan.link/*` كـWorker Route. Cloudflare Custom Domains لا تدعم wildcard؛ لهذا نستخدم Route للأسماء الفرعية. تأكد أن شهادة TLS للدومين و`*.onwan.link` أصبحت Active.
6. شغّل `npm run deploy:worker`. هذا ينشر Worker وdist معًا. عند استعمال Workers Builds عبر Git اجعل Root directory هو `bio.sa`، Build command هو `npm run build`، وDeploy command هو `npx wrangler deploy`. أدخل `VITE_*` في بيئة البناء، وأسرار API في إعدادات Worker التشغيلية.
7. راقب `npx wrangler tail` أثناء التحقق التالي؛ لا تشارك السجلات إذا احتوت بيانات عملاء أو أسرارًا.

تفاصيل DNS/Route موثقة في [أفضل ممارسات Cloudflare](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) و[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## تحقق بعد النشر

- `https://onwan.link/` يعرض الرئيسية، و`/builder` و`/admin` و`/partner` تفتح تطبيق SPA.
- `/api/does-not-exist` يعيد JSON 404 حتى لو كان طلب تنقل متصفح؛ لا يعيد index.html.
- `/api/username/check?username=df` يعيد JSON بالتوفر الحقيقي دون 500.
- جرّب التسجيل بحساب اختبار: الاسم محجوز، الصفحة مسودة، والجلسة تعمل. تأكيد الدفع يبقى من الإدارة فقط، ولا يحدث من صفحة الدفع التجريبية.
- افتح صفحة منشورة موجودة على `name.onwan.link`، وتحقق من title وOpen Graph في مصدر HTML ومن تحميل الشعار. صفحة غير منشورة تبقى غير عامة.
- تحقق من رفض الوصول دون جلسة، ومن صلاحيات موظف/مدير وشريك، ومن حفظ صفحة اختبار ثم ظهور التعديل بعد الحفظ فقط.
- رفع فيديو الخلفية يُخزَّن في Cloudflare R2 عبر binding اسمه `MEDIA` (المخزن `onwan-media` في wrangler.jsonc). أنشئه مرة واحدة قبل النشر: `npx wrangler r2 bucket create onwan-media`. لا يحتاج سرًا ولا CORS؛ الـWorker يستقبل الرفع على `/api/video-upload` ويقدّم الملفات من `/media/wallpapers/...` على أي دومين للصفحة، مع دعم المقاطع (Range). جرّب: ارفع فيديو، احفظ، حدّث الصفحة، وافتحها على الجوال.

## ما تغيّر في التنفيذ

`worker/index.ts` هو مدخل Fetch ويضم المسارات الـ12 الحالية صراحةً، مع محول يحافظ على method/query/JSON وAuthorization وOrigin، وأكواد HTTP وAllow وContent-Type والردود الثنائية والتحويلات. معالجات الأعمال والصلاحيات نفسها مستخدمة؛ ملفات `_lib` ليست مسارات عامة.

`api/_lib/runtime.ts` يعزل env لكل طلب عبر AsyncLocalStorage، دون نسخ أسرار إلى process.env. `pg` يبقى متصلًا بنفس PostgreSQL، وPool كسول لكل طلب ويُغلق في finally؛ لا تتشارك الطلبات sockets. لا يقرأ Worker ملفات .env من نظام الملفات. توافق Node مفعّل لـpg وcrypto وBuffer وdns؛ لا تتغير hashes أو صيغة الجلسات. Resend يستعمل أسرار env صراحةً، وR2 يُقرأ من binding الطلب.

Static Assets تعمل بـ`run_worker_first: true`؛ يجري حسم API قبل SPA. جذر wildcard يستعمل نفس public-page handler لإضافة SEO، والقالب يأتي من binding ASSETS مباشرة، دون fetch دائري للدومين الرئيسي. `www` يعرض الرئيسية، وworkers.dev يُعامل كعنوان معاينة للمنصة.

## دومينات العملاء الخاصة (غير name.onwan.link)

Lookup الدومينات المفعلة في `custom_domains` باقٍ، وكذلك خطوات الدفع والتحقق والصلاحيات. الربط التلقائي بـVercel معطل داخل Worker؛ يستعمل المسار اليدوي الموجود (`hostingConfigured: false`). **CNAME وحده لا يربط دومين عميل خارجي بـWorker أو يصدر شهادته**: يلزم provision فعلي عبر Cloudflare for SaaS/Custom Hostnames أو إدارة الدومين وإضافته إلى Worker يدويًا، ثم تأكيد الموظف بعد التحقق. لا يضع التحويل قيمة A وهمية لدومينات العملاء الرئيسية؛ غياب CUSTOM_DOMAIN_APEX_IP يعيد خطأ إعداد واضحًا. تجهيز نظام Cloudflare for SaaS تلقائي كامل خارج نطاق تحويل الاستضافة الحالي.

## مراجعة الاعتماديات وحدود التحقق

| الملفات/الحزمة | المعالجة |
|---|---|
| كل api/auth/* وpage/me وusername/check وreport وaccount وadmin وpartner وpublic-page وvideo-upload | مسارات Fetch مثبتة بقائمة واختبار يطابقها مع جميع ملفات API |
| pg وpg-pool وnet/tls | nodejs_compat، Pool لكل طلب، معاملات PostgreSQL الحالية باقية |
| auth/password/otp/admin/partner وnode:crypto وBuffer | اختبار HMAC وscrypt في Node وworkerd؛ لا تغيير للحسابات الموجودة |
| Resend | HTTP، قراءة المفتاح من env داخل الطلب |
| تخزين فيديو الخلفية | Cloudflare R2 (binding `MEDIA`) بدل Vercel Blob؛ الفيديوهات القديمة المحفوظة بروابط Blob تبقى تعمل كما هي |
| domains وnode:dns/promises | DNS عبر توافق Workers؛ إعداد الهدف ديناميكي، وربط الاستضافة يدوي |
| public-page وfetch | ASSETS لقالب SEO، والردود الثنائية/التحويلات محفوظة |
| shared/* | دوال خالصة، لا تعتمد على بيئة Vercel |
| fs/path وقراءة env المحلية السابقة | أزيلت من db؛ التحميل المحلي عبر Vite فقط |

الاختبارات لا تثبت صحة أسرار الإنتاج أو DNS أو اتصال Supabase الحقيقي أو إرسال البريد أو مخزن R2 الحقيقي. هذه تحتاج التحقق أعلاه بعد النشر. لا تُعدّل قاعدة البيانات الحقيقية أو تُنشأ حسابات عليها أثناء الاختبارات الآلية.

ملفات المثال أصبحت placeholders فقط. إذا كانت أي قيم حقيقية سابقة قد نُشرت أو شاركت، استبدل تلك القيم لدى مزوديها، ومنها SESSION_SECRET؛ لا يكفي حذفها من المثال لإبطالها.

## تفعيل الدفع التجريبي مؤقتًا

بطلب المالك، `DEMO_PAYMENT_ENABLED=true` في vars يسمح للمستخدم المسجل بتأكيد سلته أو فاتورة تجديده تجريبيًا وتفعيل الاشتراك والنشر فعليًا. تُسجّل العملية بمرجع `DEMO:` وتحصيل صفر، دون خصم مالي. لا تُمدّد العملية نفسها الاشتراك عند تكرار الطلب. سلة `TEST` تنشئ سلة اشتراك بصفر عند غياب الأسعار. فعّل `VITE_DEMO_PAYMENT=true` عند بناء واجهة التجربة. لإيقاف هذا المسار عند ربط بوابة الدفع اضبط `DEMO_PAYMENT_ENABLED=false` وأعد البناء دون `VITE_DEMO_PAYMENT=true` ثم انشر. إيقاف الوضع لا يلغي الاشتراكات التجريبية السابقة.

خطوات إزالة خيارات التجربة والتحويل إلى الدفع الحقيقي ومراجعة الاشتراكات التجريبية: [PAYMENT_GO_LIVE.md](./PAYMENT_GO_LIVE.md).

## إلغاء جلسات العميل عند استعادة كلمة المرور

قبل نشر هذا التعديل طبّق `database/phase26-session-revocation.sql` على قاعدة البيانات المستهدفة، ثم انشر الكود. الترحيل إضافي وقابل لإعادة التشغيل؛ لا يُبطل الجلسات الموجودة وحده. لا تنشر الكود قبل إضافة العمود.

كل جلسة عميل تحمل `sessionVersion`، ويقارنه `requireUser` مع `users.session_version` ضمن الاستعلام الموجود أصلًا. الرموز القديمة تُعامل كإصدار صفر وتظل تعمل إلى أول استعادة. استعادة كلمة المرور تحدث الهاش وتزيد الإصدار في نفس تحديث PostgreSQL؛ الجلسة الجديدة تحمل الإصدار الجديد، وكل الجلسات الأقدم تُرفض بـ401 عند طلبها التالي. لا يوجد استعلام إضافي لكل طلب، ومدة الجلسة تبقى 30 يومًا. دخول العميل عبر البريد ومسارا تهيئة الحساب عبر الشريك يستخدمون الإصدار الحالي. جلسات الموظفين والشركاء الإدارية لا تتغير.

اختبارات الانحدار: `node --test tests/session-revocation.test.cjs tests/otp-concurrency.test.cjs tests/worker.test.cjs`. قبل الإطلاق جرّب استعادة حساب تجريبي مفتوح على متصفحين: المتصفح القديم يُخرج عند أول طلب محمي، ومتصفح الاستعادة يبقى داخل الحساب. الإلغاء لا يدفع إشعارًا فوريًا للأجهزة الخاملة. لا تتراجع إلى كود قديم يتجاهل الإصدار بعد التفعيل، لأنه يعيد قبول الجلسات الملغاة حتى انتهاء مدتها.

## اقتراح اسم الجمعية دون حجز

طبّق `database/phase27-nonprofit-suggested-username.sql` قبل نشر الكود. التسجيل بـ`nonprofit: true` يحفظ الاسم في `pages.suggested_username` دون فحص توفره أو إنشاء `username_reservations`. العمود غير فريد، ولا يمنع اختيار نفس الاقتراح بحساب آخر، ولا يمنح رابطًا عامًا. عرض المالك يعرض الاسم الثابت أو الحجز القديم أولًا، ثم الاقتراح. مسار العميل العادي وحجوزاته الحالية لم يتغير. الحجوزات القديمة للجمعيات لم تُحذف تلقائيًا. التحقق والحجز النهائي في مسار تحصيل/تفعيل الجمعيات يحتاج تنفيذًا عند بناء ذلك المسار؛ لم تُضف آلية دفع أو نشر جديدة هنا.
