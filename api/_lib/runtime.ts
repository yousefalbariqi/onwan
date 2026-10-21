import { AsyncLocalStorage } from 'node:async_hooks';
import type { Pool } from 'pg';

export interface RuntimeEnv {
  HYPERDRIVE?: { connectionString: string };
  ASSETS?: { fetch(request: Request): Promise<Response> };
  [key: string]: unknown;
}
export interface RequestRuntime {
  env: RuntimeEnv;
  pool?: Pool;
}
const requests = new AsyncLocalStorage<RequestRuntime>();
export const requestRuntime = () => requests.getStore();
export function getEnv(name: string): string | undefined {
  const scope = requestRuntime();
  // Never fall back to process-wide secrets inside a Worker request.
  const value = scope ? scope.env[name] : process.env[name];
  return typeof value === 'string' ? value : undefined;
}
// A Cloudflare binding (e.g. the R2 bucket MEDIA); undefined outside a Worker.
export function getBinding<T>(name: string): T | undefined {
  const value = requestRuntime()?.env[name];
  return value && typeof value === 'object' ? (value as T) : undefined;
}
export function withRuntime<T>(scope: RequestRuntime, callback: () => T): T {
  return requests.run(scope, callback);
}
