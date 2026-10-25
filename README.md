# عنوان (onwan)

صفحة واحدة لكل جهة على `name.onwan.link` تجمع التعريف والشعار والروابط والصور وملفات PDF.

المتطلبات المرجعية في المجلد الأعلى: `onwan_requirements_reference.docx` و `onwan_miro_cards.xlsx`.
تفاصيل المعمارية وما بُني وما لم يُبنَ بعد في `CLAUDE.md`.

## التشغيل

```bash
npm i
cp .env.example .env.local   # ثم عبّئ القيم
npm run dev
```

طبّق ملفات `database/` بالترتيب المذكور في `CLAUDE.md` قبل التشغيل.

## Cloudflare Workers

دليل النشر والأسرار وDNS والاختبارات: [CLOUDFLARE_DEPLOY.md](./CLOUDFLARE_DEPLOY.md).

```sh
npm run dev:worker      # dist + محاكي Workers؛ الأسرار في .dev.vars
npm run build:worker    # بناء وتجميع دون نشر
npm run check:worker
npm run test:content
npm run test:worker
npm run deploy:worker   # نشر Worker وStatic Assets
```

خيارات تفعيل الدفع التجريبي وخطوات إيقافها عند الإطلاق: [PAYMENT_GO_LIVE.md](./PAYMENT_GO_LIVE.md).

ملاحظات أمنية مفتوحة قبل الإطلاق، ومنها آلية المصادقة الحالية: [SECURITY_NOTES.md](./SECURITY_NOTES.md).

مسارا بيع الشريك والمحرر ورابط الأسعار الخاص: [PARTNER_SALES.md](./PARTNER_SALES.md).
