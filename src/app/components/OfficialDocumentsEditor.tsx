import { forwardRef, useRef, useState } from 'react';
import { FileText, RefreshCw, Trash2, Upload } from 'lucide-react';
import { usePageContext } from '../context/PageContext';
import { OFFICIAL_DOCUMENTS, OfficialDocumentId } from '../lib/officialDocuments';
import { MAX_LINKS } from '../lib/site';
import { ConfirmSheet, Group } from './ios';

// Note 27: «الوثائق الرسمية» in the nonprofit editor — one slot per document,
// PDF only. Uploading adds a file item to «المحتوى»; deleting removes it, so
// visitors see only the documents that were uploaded.

const MAX_PDF_SIZE = 10 * 1024 * 1024;

function formatFileSize(size?: number) {
  if (!size || size <= 0) return '';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
  });
}

export const OfficialDocumentsEditor = forwardRef<HTMLDivElement>(function OfficialDocumentsEditor(_, ref) {
  const { pageData, addLink, updateLink, removeLink } = usePageContext();
  const links = pageData.links;
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<null | { id: string; title: string }>(null);
  const inputs = useRef<Partial<Record<OfficialDocumentId, HTMLInputElement | null>>>({});

  const pick = async (docType: OfficialDocumentId, file: File) => {
    if (file.type !== 'application/pdf') { setError('الوثائق الرسمية تُرفع بصيغة PDF فقط.'); return; }
    if (file.size > MAX_PDF_SIZE) { setError('حجم ملف PDF كبير. الحد الأقصى 10MB.'); return; }
    const current = links.find((link) => link.display?.kind === 'document' && link.display.docType === docType);
    if (!current && links.length >= MAX_LINKS) { setError(`وصلت إلى الحد (${MAX_LINKS}). احذف عنصرًا لتضيف الوثيقة.`); return; }
    setError('');
    try {
      const url = await readFileAsDataUrl(file);
      const kind = OFFICIAL_DOCUMENTS.find((item) => item.id === docType)!;
      const file_ = { url, fileName: file.name, fileMimeType: 'application/pdf', fileSize: file.size };
      if (current) updateLink(current.id, file_);
      else addLink({ ...file_, title: kind.title, titleEn: kind.titleEn, platform: 'file', linkType: 'file', fileCategory: 'other', iconStyle: 'color', textPosition: 'center', display: { kind: 'document', docType } });
    } catch {
      setError('تعذر قراءة الملف. حاول مرة أخرى.');
    }
  };

  return (
    <div ref={ref}>
      <Group title="الوثائق الرسمية" footer={error || 'ملفات PDF حتى 10MB. تظهر للزوار الوثائق المرفوعة فقط، كبطاقات رسمية تعزز موثوقية الجمعية.'}>
        {OFFICIAL_DOCUMENTS.map((kind) => {
          const doc = links.find((link) => link.display?.kind === 'document' && link.display.docType === kind.id);
          return (
            <div key={kind.id} className="flex min-h-[60px] items-center gap-3 px-4 py-2">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] ${doc ? 'bg-[#c0392b]/10 text-[#c0392b]' : 'bg-[#f2f2f7] text-[#8e8e93]'}`}><FileText className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] text-[#1d1d1f]">{kind.title}</span>
                <span className="block truncate text-xs text-[#8e8e93]">{doc ? [doc.hidden ? 'مخفية عن الزوار' : 'PDF', formatFileSize(doc.fileSize)].filter(Boolean).join(' · ') : 'لم تُرفع بعد'}</span>
              </span>
              <input ref={(node) => { inputs.current[kind.id] = node; }} type="file" accept="application/pdf" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void pick(kind.id, file); }} />
              {doc ? (
                <>
                  <button type="button" onClick={() => inputs.current[kind.id]?.click()} aria-label={`تغيير «${kind.title}»`} className="flex h-10 items-center gap-1 rounded-full bg-[#f2f2f7] px-3 text-xs font-bold text-[#1d1d1f]"><RefreshCw className="h-3.5 w-3.5" />تغيير</button>
                  <button type="button" onClick={() => setDeleting({ id: doc.id, title: kind.title })} aria-label={`حذف «${kind.title}»`} className="flex h-10 w-10 items-center justify-center rounded-full text-[#ff3b30] active:bg-[#f2f2f7]"><Trash2 className="h-[18px] w-[18px]" /></button>
                </>
              ) : (
                <button type="button" onClick={() => inputs.current[kind.id]?.click()} className="flex h-10 items-center gap-1 rounded-full bg-[#0a84ff]/10 px-3 text-xs font-bold text-[#0a84ff]"><Upload className="h-3.5 w-3.5" />رفع PDF</button>
              )}
            </div>
          );
        })}
      </Group>
      {deleting && (
        <ConfirmSheet title={`حذف «${deleting.title}»؟`} message="ستختفي الوثيقة من صفحتك، ويمكنك رفعها مجددًا في أي وقت." confirmLabel="حذف الوثيقة" cancelLabel="إلغاء" onConfirm={() => { removeLink(deleting.id); setDeleting(null); }} onCancel={() => setDeleting(null)} />
      )}
    </div>
  );
});
