import type { PageData } from '../context/PageContext';
import { moveInlineMedia } from './mediaUpload';
import { takeTurnstileToken } from './turnstile';

export type CreationSession = { token: string; id: string; email: string; revision: number; syncedSequence?: number };
const KEY = 'onwan_creation_cloud_session';
export function creationSession(): CreationSession | null {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return value?.token && value?.id && value?.email && Number.isSafeInteger(value.revision) ? value : null; } catch { return null; }
}
export function storeCreationSession(value: CreationSession) {
  const { token, id, email, revision, syncedSequence } = value;
  sessionStorage.setItem(KEY, JSON.stringify({ token, id, email, revision, syncedSequence }));
}
export function clearCreationSession() { try { sessionStorage.removeItem(KEY); } catch { /* Local design remains available. */ } }
async function json<T>(url: string, options: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'تعذر الاتصال بخدمة حفظ المسودة. حاول مجددًا.'), { code: body.code, status: response.status });
  return body;
}
export function sendCreationCode(email: string) {
  return json<{ message: string; retryAfter: number }>('/api/auth/creation-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'send', email, turnstileToken: takeTurnstileToken() }) });
}
export function verifyCreationCode(email: string, code: string, clientKey?: string) {
  return json<CreationSession & { existingAccount?: boolean; pageData?: PageData | null }>('/api/auth/creation-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', email, code, clientKey }) });
}
export function readCloudCreation(session: CreationSession) {
  return json<{ pageData: PageData | null; revision: number; termsAccepted?: boolean }>('/api/creation-draft', { headers: { Authorization: `Bearer ${session.token}` } });
}
const synced = new Map<string, string>();
const pending = new Map<string, { json: string; operationId: string }>();
export async function writeCloudCreation(pageData: PageData, sequence: number) {
  const session = creationSession();
  if (!session) return pageData;
  const prepared = await moveInlineMedia(pageData, session.token);
  const body = JSON.stringify(prepared);
  if (synced.get(session.token) === body) return prepared;
  let operation = pending.get(session.id);
  if (!operation || operation.json !== body) { operation = { json: body, operationId: crypto.randomUUID() }; pending.set(session.id, operation); }
  const result = await json<{ revision: number }>('/api/creation-draft', { method: 'PATCH', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pageData: prepared, revision: session.revision, operationId: operation.operationId }) });
  // Do not rebind a newer verification session if it changed while this request ran.
  if (creationSession()?.token === session.token) storeCreationSession({ ...session, revision: result.revision, syncedSequence: sequence });
  synced.set(session.token, body);
  pending.delete(session.id);
  return prepared;
}

export function changeCreationEmail(action: 'change-send' | 'change-verify', email: string, code?: string) {
  const session = creationSession();
  if (!session) throw new Error('أعد التحقق من بريد المسودة.');
  return json<CreationSession & { retryAfter?: number }>('/api/auth/creation-email', { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email, code, turnstileToken: action === 'change-send' ? takeTurnstileToken() : undefined }) });
}
