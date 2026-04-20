export function sendJson(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(body));
}

export async function readJsonBody(req: any) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
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
  console.error(error);

  const message = error instanceof Error ? error.message : 'Unexpected error';
  sendJson(res, 500, { error: message });
}
