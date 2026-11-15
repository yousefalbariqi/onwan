import { nonprofitPath } from './nonprofit';

export type JourneyKind = 'standard' | 'nonprofit';

// Account kind selects business behavior; the host only selects the entry point.
export const journeyPath = (kind: JourneyKind, page = '') =>
  kind === 'nonprofit' ? nonprofitPath(page) : `/${page}`;

export const journeyCopy = {
  standard: {
    nameLabel: 'اسم الصفحة', identityTitle: 'عرّف بنفسك أو بجهتك',
    identityDescription: 'تظهر هذه البيانات في صفحتك.', bioLabel: 'نبذة تعريفية',
    bioPlaceholder: 'سطر أو سطران عنك أو عن خدماتك',
    selectionDescription: 'اختر ما تود البدء به ليظهر في صفحتك.',
    startLabel: 'ابدأ إنشاء صفحتك', homeLabel: 'عنوان — الرئيسية',
  },
  nonprofit: {
    nameLabel: 'اسم الجمعية', identityTitle: 'عرّف بجمعيتك',
    identityDescription: 'تظهر هذه البيانات في صفحة جمعيتكم.', bioLabel: 'نبذة عن الجمعية',
    bioPlaceholder: 'سطر أو سطران عن رسالة الجمعية وخدماتها',
    selectionDescription: 'اختر ما تود البدء به ليظهر في صفحة جمعيتك.',
    startLabel: 'ابدأ إنشاء صفحة جمعيتك', homeLabel: 'عنوان — الجمعيات',
  },
} as const;
