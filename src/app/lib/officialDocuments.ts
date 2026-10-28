// Note 27: a nonprofit's official documents. Each one is a PDF file item in
// «المحتوى» marked `display.kind = 'document'`. Note 24: shown as an ordinary
// button, ordered with everything else. The ids are stored — never rename one.
export const OFFICIAL_DOCUMENTS = [
  { id: 'registration', title: 'شهادة تسجيل الجمعية', titleEn: 'Registration certificate' },
  { id: 'license', title: 'وثيقة ترخيص الجمعية', titleEn: 'Association license' },
  { id: 'fundraising', title: 'ترخيص جمع التبرعات', titleEn: 'Fundraising license' },
  { id: 'governance', title: 'شهادة الحوكمة', titleEn: 'Governance certificate' },
] as const;

// Note 24: the documents' own mark, used as their button icon by default.
export const OFFICIAL_DOCUMENT_ICON = '/nonprofit/official-docs.png';

export type OfficialDocumentId = (typeof OFFICIAL_DOCUMENTS)[number]['id'];
