import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageProvider, mergeWithDefaults, type PageSource } from '../context/PageContext';
import { adminCall } from '../admin/adminApi';
import { TEMPLATE_SAMPLE, extractDesign, type PageTemplate } from '../lib/pageDesign';
import { TemplatePreview } from '../components/TemplatePreview';
import { ConfirmSheet } from '../components/ios';
import Builder from './Builder';

// «صانع القوالب» (/nonprofit/theme-builder): the manager makes the ready-made
// templates associations see. Access comes from the administration sign-in
// («مدير عنوان» only) — the link alone opens nothing. A template is designed
// in the same editor, on generic sample content that is never saved with it.

type ListResult = { templates: PageTemplate[]; more: boolean; categories: string[] };
const STATUS_LABEL: Record<PageTemplate['status'], string> = { draft: 'مسودة', visible: 'ظاهر', hidden: 'مخفي' };
const STATUS_TONE: Record<PageTemplate['status'], string> = { draft: 'bg-[#f2f2f7] text-[#3a3a3c]', visible: 'bg-[#34c759]/15 text-[#1f8a3b]', hidden: 'bg-[#FFF0E8] text-[#F25A18]' };
const fieldClass = 'w-full rounded-xl border border-[#E7E7E7] bg-white px-3 py-2.5 text-[15px] focus:border-[#FF6B2C] focus:outline-none';

export default function ThemeBuilder() {
  const [access, setAccess] = useState<'checking' | 'ok' | 'denied'>('checking');
  const [editing, setEditing] = useState<PageTemplate | null>(null);

  useEffect(() => {
    adminCall<{ staff: { role: string } }>('me')
      .then((r) => setAccess(r.staff.role === 'manager' ? 'ok' : 'denied'))
      .catch(() => setAccess('denied'));
  }, []);

  if (access === 'checking') return <div className="min-h-screen bg-[#F8F8F6]" />;
  if (access === 'denied') {
    return (
      <main dir="rtl" className="flex min-h-screen items-center justify-center bg-[#F8F8F6] p-4" style={{ fontFamily: 'Tajawal, sans-serif' }}>
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>صانع القوالب</h1>
          <p className="mt-2 text-sm text-[#737373]">هذه الصفحة لمدير عنوان. سجّل الدخول من لوحة الإدارة ثم افتحها من جديد.</p>
          <a href="/admin" className="mt-5 inline-flex rounded-full bg-[#FF6B2C] px-5 py-2.5 font-bold text-white hover:bg-[#F25A18]">لوحة الإدارة</a>
        </div>
      </main>
    );
  }
  return editing ? <TemplateEditor template={editing} onExit={() => setEditing(null)} /> : <TemplateList onEdit={setEditing} />;
}

// The same editor as the associations', loading and saving a template.
function TemplateEditor({ template, onExit }: { template: PageTemplate; onExit: () => void }) {
  const id = useRef(template.id);
  const source = useMemo<PageSource>(() => ({
    load: async () => ({ pageData: mergeWithDefaults({ ...TEMPLATE_SAMPLE, ...template.design }) }),
    save: async (pageData) => {
      const r = await adminCall<{ template: PageTemplate }>('templates.save', { id: id.current, design: extractDesign(pageData) });
      return { pageData: { ...TEMPLATE_SAMPLE, ...r.template.design } };
    },
  }), [template]);
  return (
    <PageProvider source={source}>
      <Builder editor={{ sections: ['header', 'style', 'wallpaper'], logoZoomOut: true, logoBanner: true }} staffEdit={{ title: `قالب: ${template.name}`, onExit, exitLabel: 'العودة إلى القوالب' }} />
    </PageProvider>
  );
}

function TemplateList({ onEdit }: { onEdit: (template: PageTemplate) => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ id?: string; name: string; category: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<PageTemplate | null>(null);
  const request = useRef(0);

  const load = useCallback((offset: number) => {
    const id = ++request.current;
    setLoading(true);
    adminCall<ListResult>('templates.list', { query, category, offset })
      .then((next) => { if (id === request.current) setResult((prev) => (offset && prev ? { ...next, templates: [...prev.templates, ...next.templates] } : next)); })
      .catch((e) => setError(e instanceof Error ? e.message : 'تعذر تحميل القوالب.'))
      .finally(() => { if (id === request.current) setLoading(false); });
  }, [query, category]);

  useEffect(() => { const t = window.setTimeout(() => load(0), query ? 300 : 0); return () => window.clearTimeout(t); }, [load, query]);

  const replace = (template: PageTemplate) => setResult((prev) => prev && { ...prev, templates: prev.templates.map((t) => (t.id === template.id ? template : t)) });
  const run = async (task: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر الحفظ.'); } finally { setBusy(false); }
  };

  // A new template starts from the default look as a draft, then opens in the editor.
  const submitForm = () => run(async () => {
    if (!form) return;
    if (form.id) {
      replace((await adminCall<{ template: PageTemplate }>('templates.rename', form)).template);
      setForm(null);
      return;
    }
    const r = await adminCall<{ template: PageTemplate }>('templates.save', { name: form.name, category: form.category, design: extractDesign(mergeWithDefaults({})) });
    setForm(null);
    onEdit(r.template);
  });

  return (
    <main dir="rtl" className="min-h-screen bg-[#F8F8F6] px-4 py-8" style={{ fontFamily: 'Tajawal, sans-serif' }}>
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>صانع القوالب</h1>
            <p className="text-sm text-[#737373]">القوالب تحمل التصميم فقط. القالب الجديد مسودة حتى تظهره.</p>
          </div>
          <button type="button" onClick={() => setForm({ name: '', category: category })} className="flex items-center gap-1.5 rounded-full bg-[#FF6B2C] px-4 py-2.5 font-bold text-white hover:bg-[#F25A18]"><Plus className="h-4 w-4" />قالب جديد</button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-[#E7E7E7] bg-white px-3">
            <Search className="h-4 w-4 text-[#737373]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو التصنيف" aria-label="ابحث في القوالب" className="min-w-0 flex-1 bg-transparent py-2.5 focus:outline-none" />
          </label>
          {['', ...(result?.categories ?? [])].map((item) => (
            <button key={item || 'all'} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${category === item ? 'bg-[#111111] text-white' : 'bg-white text-[#3a3a3c] border border-[#E7E7E7]'}`}>{item || 'الكل'}</button>
          ))}
        </div>

        {error && <p role="alert" className="rounded-xl bg-[#FEE2E2] px-4 py-2 text-sm text-[#DC2626]">{error}</p>}
        {result && result.templates.length === 0 && <p className="py-12 text-center text-[#737373]">لا توجد قوالب بعد. ابدأ بـ«قالب جديد».</p>}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {result?.templates.map((template) => (
            <article key={template.id} className="space-y-2 rounded-3xl bg-white p-3 shadow-sm">
              <button type="button" onClick={() => onEdit(template)} className="block w-full" aria-label={`تعديل قالب ${template.name}`}><TemplatePreview design={template.design} /></button>
              <div className="flex items-center justify-between gap-2">
                <h2 className="truncate font-bold text-[#111111]">{template.name}</h2>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[template.status]}`}>{STATUS_LABEL[template.status]}</span>
              </div>
              <p className="truncate text-xs text-[#737373]">{template.category || 'بدون تصنيف'}</p>
              <p className="text-xs text-[#737373]">جُرّب {template.tried_count.toLocaleString('ar-u-nu-latn')} · استُخدم {template.used_count.toLocaleString('ar-u-nu-latn')}</p>
              <div className="flex items-center gap-1 border-t border-[#E7E7E7] pt-2">
                <button type="button" disabled={busy} onClick={() => run(async () => replace((await adminCall<{ template: PageTemplate }>('templates.setStatus', { id: template.id, status: template.status === 'visible' ? 'hidden' : 'visible' })).template))} className="flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-bold text-[#111111] hover:bg-[#F8F8F6] disabled:opacity-50">
                  {template.status === 'visible' ? <><EyeOff className="h-3.5 w-3.5" />إخفاء</> : <><Eye className="h-3.5 w-3.5" />إظهار</>}
                </button>
                <button type="button" onClick={() => setForm({ id: template.id, name: template.name, category: template.category })} aria-label="الاسم والتصنيف" className="rounded-lg p-1.5 text-[#737373] hover:bg-[#F8F8F6]"><Pencil className="h-4 w-4" /></button>
                <button type="button" onClick={() => setRemoving(template)} aria-label="حذف" className="rounded-lg p-1.5 text-[#DC2626] hover:bg-[#FEE2E2]"><Trash2 className="h-4 w-4" /></button>
              </div>
            </article>
          ))}
        </div>
        {result?.more && <button type="button" disabled={loading} onClick={() => load(result.templates.length)} className="mx-auto block rounded-full border border-[#E7E7E7] bg-white px-5 py-2.5 font-bold text-[#111111] disabled:opacity-50">{loading ? '…' : 'عرض المزيد'}</button>}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={form.id ? 'الاسم والتصنيف' : 'قالب جديد'}>
          <form onSubmit={(e) => { e.preventDefault(); void submitForm(); }} className="w-full max-w-sm space-y-3 rounded-3xl bg-white p-5">
            <h2 className="text-lg font-black text-[#111111]" style={{ fontFamily: 'Cairo, sans-serif' }}>{form.id ? 'الاسم والتصنيف' : 'قالب جديد'}</h2>
            <input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={60} placeholder="اسم القالب، مثل: هادئ" aria-label="اسم القالب" className={fieldClass} />
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={40} list="template-categories" placeholder="التصنيف (اختياري)" aria-label="التصنيف" className={fieldClass} />
            <datalist id="template-categories">{result?.categories.map((item) => <option key={item} value={item} />)}</datalist>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy || !form.name.trim()} className="flex-1 rounded-full bg-[#FF6B2C] py-2.5 font-bold text-white hover:bg-[#F25A18] disabled:opacity-50">{form.id ? 'حفظ' : 'إنشاء وفتح المحرر'}</button>
              <button type="button" onClick={() => setForm(null)} className="rounded-full px-4 py-2.5 font-bold text-[#737373]">إلغاء</button>
            </div>
          </form>
        </div>
      )}
      {removing && (
        <ConfirmSheet title={`حذف «${removing.name}»؟`} message="يختفي من القوالب الجاهزة. صفحات الجمعيات التي استخدمته تبقى كما هي." confirmLabel="حذف" cancelLabel="إلغاء"
          onConfirm={() => { const target = removing; setRemoving(null); void run(async () => { await adminCall('templates.delete', { id: target.id }); setResult((prev) => prev && { ...prev, templates: prev.templates.filter((t) => t.id !== target.id) }); }); }}
          onCancel={() => setRemoving(null)} />
      )}
    </main>
  );
}
