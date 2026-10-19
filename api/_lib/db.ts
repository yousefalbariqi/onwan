import { Pool } from 'pg';
import { getEnv, requestRuntime } from './runtime.js';

let localPool: Pool | undefined;
function createPool() {
  const connectionString = getEnv('DATABASE_URL') || getEnv('SUPABASE_DATABASE_URL') || getEnv('POSTGRES_URL');
  if (!connectionString) throw new Error('DATABASE_URL is not configured');
  const url = new URL(connectionString);
  if (url.hostname.toLowerCase() === 'host') throw new Error('Database hostname is still a placeholder');
  return new Pool({
    connectionString,
    ssl: ['localhost', '127.0.0.1'].includes(url.hostname) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
    // reserveUsername checks availability while a transaction holds a client.
    max: 3,
    idleTimeoutMillis: 5000,
  });
}
function getPool() {
  const scope = requestRuntime();
  if (scope) return scope.pool ??= createPool();
  return localPool ??= createPool();
}
// Workers sockets must never be reused by a different request. The entrypoint
// closes the request's pool after the handler finishes, including on errors.
export const pool = new Proxy({} as Pool, {
  get(_target, property) {
    const realPool = getPool();
    const value = Reflect.get(realPool, property, realPool);
    return typeof value === 'function' ? value.bind(realPool) : value;
  },
});
