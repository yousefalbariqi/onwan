import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageProvider, PageSource } from '../context/PageContext';
import { adminLink } from '../lib/site';
import Builder from '../pages/Builder';
import { adminCall } from './adminApi';

// PERM-01: an employee edits a customer's page with the same editor the
// customer uses, loading and saving through the administration API.
export default function StaffPageEditor() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const nonprofit = params.get('nonprofit');
  const back = new URLSearchParams();
  if (nonprofit) {
    back.set('section', 'nonprofits'); back.set('nonprofit', nonprofit);
    for (const key of ['q', 'status', 'page']) if (params.get(key)) back.set(key, params.get(key)!);
  } else back.set('customer', userId || '');

  const source = useMemo<PageSource>(
    () => {
      let revision: number | null = null;
      let pending: { pageData: any; revision: number; operationId: string } | null = null;
      return {
        load: async () => { const result = await adminCall<any>('content.getPage', { userId }); revision = result.revision; return result; },
        save: async (pageData) => {
          if (pending) {
            const request = pending;
            const result = await adminCall<any>('content.save', { userId, ...request });
            revision = result.revision; pending = null;
            if (JSON.stringify(pageData) === JSON.stringify(request.pageData)) return result;
          }
          pending = { pageData, revision: revision!, operationId: crypto.randomUUID() };
          const result = await adminCall<any>('content.save', { userId, ...pending });
          revision = result.revision; pending = null; return result;
        },
      };
    },
    [userId],
  );

  return (
    <PageProvider source={source}>
      <Builder editor={nonprofit ? { sections: ['header', 'links', 'style', 'wallpaper'], logoZoomOut: true, logoBanner: true } : undefined} staffEdit={{ title: nonprofit ? 'تعديل صفحة الجمعية' : undefined, exitLabel: nonprofit ? 'العودة إلى طلب الجمعية' : undefined, onExit: () => navigate(`${adminLink()}?${back}`) }} />
    </PageProvider>
  );
}
