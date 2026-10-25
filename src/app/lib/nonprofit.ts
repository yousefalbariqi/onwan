import { isNonprofitHost } from './site';
export const nonprofitPath = (path = '') => `${isNonprofitHost() ? '/' : '/nonprofit/'}${path}`;
export const quoteStatus: Record<string,string> = { pending:'بانتظار المراجعة', contacted:'تم التواصل بشأن العرض', agreed:'تم الاتفاق — بانتظار التفعيل', cancelled:'الطلب ملغى' };
