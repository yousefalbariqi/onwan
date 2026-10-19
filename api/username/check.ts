import { getUsernameAvailability } from '../_lib/username.js';
import { allowMethods, handleApiError, sendJson } from '../_lib/http.js';

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['GET'])) {
    return;
  }

  try {
    const username = String(req.query.username ?? '');

    const availability = await getUsernameAvailability(username);

    sendJson(res, 200, availability);
  } catch (error) {
    handleApiError(res, error);
  }
}
