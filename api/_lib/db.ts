import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

dns.setDefaultResultOrder('ipv4first');

declare global {
  // eslint-disable-next-line no-var
  var __bioSaPool: Pool | undefined;
}

function loadLocalEnvFiles() {
  const rootDir = process.cwd();
  const candidateFiles = ['.env.local', '.env'];

  for (const fileName of candidateFiles) {
    const filePath = path.join(rootDir, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');

    for (const line of fileContents.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf('=');

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnvFiles();

function createPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.POSTGRES_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL or SUPABASE_DATABASE_URL is not configured');
  }

  return new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    // Force IPv4 to avoid ENETUNREACH on IPv6-only Supabase DNS
    ...(connectionString.includes('localhost') ? {} : {
      connectionTimeoutMillis: 10000,
    }),
  });
}

export const pool = global.__bioSaPool ?? createPool();

if (!global.__bioSaPool) {
  global.__bioSaPool = pool;
}
