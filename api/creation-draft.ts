import { requireCreationDraft, saveCreationCloudDraft } from './_lib/creationDraft.js';
import { allowMethods, handleApiError, readJsonBody, sendJson } from './_lib/http.js';
export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET', 'PATCH'])) return;
  try {
    const draft = await requireCreationDraft(req);
    if (req.method === 'GET') { sendJson(res, 200, { pageData: draft.page_json, revision: Number(draft.revision), email: draft.email, termsAccepted: Boolean(draft.terms_accepted_at && draft.terms_version === 'account-v1') }); return; }
    sendJson(res, 200, await saveCreationCloudDraft(draft.id, await readJsonBody(req)));
  } catch (error) { handleApiError(res, error); }
}
