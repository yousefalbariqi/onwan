import { isNonprofitHost } from './site';
export const nonprofitPath = (path = '') => `${isNonprofitHost() ? '/' : '/nonprofit/'}${path}`;
export const quoteStatus: Record<string,string> = { pending:'بانتظار المراجعة', contacted:'تم التواصل بشأن العرض', agreed:'تم الاتفاق — بانتظار التفعيل', quoted:'بانتظار التحويل', paid:'تم تأكيد التحويل', active:'مفعّل', cancelled:'الطلب ملغى' };

// Annual association price, shared by the landing, purchase summary and new quotes.
export const NONPROFIT_ANNUAL_PRICE_SAR = 190;

export const NONPROFIT_ANNUAL_PRICE_LABEL = NONPROFIT_ANNUAL_PRICE_SAR.toLocaleString('ar-SA');
