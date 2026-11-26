import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, Pencil, Plus, UserRound } from 'lucide-react';
import { OnwanLogo } from '../components/OnwanLogo';
import { hasTransparency } from '../lib/imageTransparency';
import { ProfileImageSheet } from '../components/ProfileImageSheet';
import { PageProvider, usePageContext, type PageData, type PageSource } from '../context/PageContext';
import { ImageProblem, compressImage } from '../lib/compressImage';
import { createGuestPageSource } from '../lib/creationDraftSource';
import { readCreationCategory } from '../lib/creationStart';
import { creationSample, templateGroup } from '../lib/creationTemplates';
import '../../styles/creation-start.css';

const BIO_LIMIT = 300;
const SAMPLE_IMAGE = '/template-samples/mark.svg';

// Note 9: the owner's picture, name and bio come before the designs, so every
// design is previewed with their real content.
function ProfileForm({ source }: { source: PageSource }) {
  const navigate = useNavigate();
  const { pageData, loadingPage, updatePageData, updateProfileStyle } = usePageContext();
  const sample = useMemo(() => creationSample(templateGroup(readCreationCategory())), []);
  const uploadId = useId();
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const [sheet, setSheet] = useState<'menu' | 'crop' | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);
  const [saving, setSaving] = useState(false);
  const request = useRef(0);

  useEffect(() => { const previous = document.title; document.title = 'أضف بياناتك — عنوان'; return () => { document.title = previous; }; }, []);

  // Sample text is shown as a hint, never as the owner's own content.
  const name = pageData.name === sample.name ? '' : pageData.name;
  const bio = pageData.bio === sample.bio ? '' : pageData.bio;
  // Grow the bio box with its text so the whole bio stays visible while typing.
  useLayoutEffect(() => {
    const el = bioRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [bio]);
  const image = pageData.profileImage === SAMPLE_IMAGE ? '' : pageData.profileImage;
  const fit = pageData.profileStyle.fit ?? 'cover';
  const zoom = pageData.profileStyle.zoom ?? 1;
  const position = `${pageData.profileStyle.positionX ?? 50}% ${pageData.profileStyle.positionY ?? 50}%`;

  const pick = async (file: File) => {
    const current = ++request.current;
    setError(''); setPreparing(true);
    try {
      const compressed = await compressImage(file, 1600, { allowSvg: true });
      const transparent = await hasTransparency(compressed);
      if (current !== request.current) return;
      updatePageData({ profileImage: compressed });
      updateProfileStyle({ fit: transparent ? 'contain' : 'cover', zoom: 1, positionX: 50, positionY: 50 });
      setSheet('crop');
    } catch (problem) {
      if (current === request.current) setError(problem instanceof ImageProblem ? problem.message : 'تعذّر تجهيز الصورة. حاول مجددًا.');
    } finally {
      if (current === request.current) setPreparing(false);
    }
  };

  const next = async () => {
    if (!name.trim()) { setNameError(true); document.getElementById(`${uploadId}-name`)?.focus(); return; }
    setSaving(true); setError('');
    try {
      const data: PageData = { ...pageData, name: name.trim(), bio: bio.trim(), profileImage: image };
      await source.saveDraft!(data);
      navigate('/signup?step=templates');
    } catch {
      setError('تعذّر حفظ بياناتك. حاول مجددًا.');
      setSaving(false);
    }
  };

  return <div className="creation-start" dir="rtl">
    <div className="creation-start__frame">
      <header className="creation-start__header">
        <Link to="/signup" className="creation-start__back" aria-label="العودة لاختيار نوع الصفحة"><ArrowRight size={22} aria-hidden="true" /></Link>
        <Link to="/" aria-label="عنوان — الرئيسية"><OnwanLogo /></Link>
      </header>
      <div className="creation-start__progress" aria-label="الخطوة 2 من 4: بياناتك">
        <div className="creation-start__step"><span>عرّفنا عليك</span><span>الخطوة 2 من 4</span></div>
        <div className="creation-start__segments" aria-hidden="true"><span className="is-current" /><span className="is-current" /><span /><span /></div>
      </div>
      <main className="creation-start__main">
        <div className="creation-start__intro">
          <h1>أضف بياناتك</h1>
          <p>تظهر هذه البيانات في صفحتك، وتقدر تعدّلها لاحقًا.</p>
        </div>
        <div className="creation-profile">
          <input id={uploadId} type="file" hidden accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg" disabled={preparing} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void pick(file);
          }} />
          {image
            ? <button type="button" className="creation-profile__avatar" disabled={preparing} onClick={() => setSheet('menu')} aria-label="خيارات الصورة">
                <span className="creation-profile__photo"><img src={image} alt="" style={{ objectFit: fit, objectPosition: position, transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: position }} /></span>
                <span className="creation-profile__badge" aria-hidden="true"><Pencil size={16} /></span>
              </button>
            : <label htmlFor={uploadId} className="creation-profile__avatar" aria-label="إضافة صورة أو شعار">
                <span className="creation-profile__photo is-empty"><UserRound size={56} aria-hidden="true" /></span>
                <span className="creation-profile__badge is-add" aria-hidden="true"><Plus size={18} strokeWidth={3} /></span>
              </label>}
          {preparing && <p role="status" className="creation-profile__status">جارٍ تجهيز الصورة…</p>}

          <label htmlFor={`${uploadId}-name`}>الاسم</label>
          <input id={`${uploadId}-name`} className={nameError ? 'has-error' : ''} value={name} maxLength={80} autoComplete="name" placeholder={sample.name} aria-invalid={nameError}
            onChange={event => { setNameError(false); updatePageData({ name: event.target.value }); }} />
          {nameError && <p role="alert" className="creation-profile__error">اكتب الاسم الذي يظهر في صفحتك.</p>}

          <label htmlFor={`${uploadId}-bio`}>النبذة</label>
          <div className="creation-profile__bio">
            <textarea ref={bioRef} id={`${uploadId}-bio`} rows={3} value={bio} maxLength={BIO_LIMIT} placeholder="سطر أو سطرين عمّا تقدمه" onChange={event => updatePageData({ bio: event.target.value })} />
            <span dir="ltr">{bio.length}/{BIO_LIMIT}</span>
          </div>
          {error && <p role="alert" className="creation-profile__error">{error}</p>}
        </div>
        <div className="creation-start__actions">
          <button type="button" className="creation-start__continue" disabled={loadingPage || preparing || saving} onClick={() => void next()}>
            <span>{saving ? 'جارٍ الحفظ…' : 'التالي'}</span><ArrowLeft size={21} aria-hidden="true" />
          </button>
        </div>
      </main>
    </div>
    {sheet && !!image && <ProfileImageSheet uploadId={uploadId} startAtCrop={sheet === 'crop'} minZoom={0.3} onClose={() => setSheet(null)}
      onRemove={() => { request.current++; updatePageData({ profileImage: '', extractedColors: [] }); }} />}
  </div>;
}

export default function CreationProfile() {
  const source = useMemo<PageSource>(() => {
    const guest = createGuestPageSource({ cloud: false });
    return {
      ...guest,
      // The first visit has no draft yet: start from the category's sample.
      load: () => guest.load().catch(() => {
        const pageData = creationSample(templateGroup(readCreationCategory())) as PageData;
        return { pageData, savedDraftData: pageData };
      }),
    };
  }, []);
  return <PageProvider source={source}><ProfileForm source={source} /></PageProvider>;
}
