// An error whose message is safe to show to the client as-is.
export class HttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  // Fetch adapter used by Cloudflare Workers; Node dev remains supported.
  if (typeof req.text === 'function') {
    const raw = await req.text();
    return raw ? JSON.parse(raw) : {};
  }

  const chunks: Uint8Array[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    req.on('end', resolve);
    req.on('error', reject);
  });

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function allowMethods(req: any, res: any, methods: string[]) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '));
    sendJson(res, 405, { error: 'Method not allowed' });
    return false;
  }

  return true;
}

export function handleApiError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message, code: error.code });
    return;
  }

  console.error(error);

  // Internal details (SQL, stack, config) stay in the server log.
  sendJson(res, 500, { error: 'حدث خطأ غير متوقع في الخادم. حاول مرة أخرى.' });
}
