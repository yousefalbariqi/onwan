import { nonprofitStatus, submitNonprofit } from './_lib/nonprofit.js';
import { requireUser } from './_lib/session.js';
import { allowMethods, handleApiError, HttpError, readJsonBody, sendJson } from './_lib/http.js';
export default async function handler(req: any, res: any) {
  if (!allowMethods(req,res,['GET','POST'])) return;
  try {
    const user = await requireUser(req,res); if (!user) return;
    if (req.method === 'GET') return sendJson(res,200,await nonprofitStatus(user.id));
    const body = await readJsonBody(req);
    if (body.action !== 'submit') throw new HttpError(400,'إجراء غير معروف.');
    sendJson(res,200,await submitNonprofit(user.id,body));
  } catch(error) { handleApiError(res,error); }
}
