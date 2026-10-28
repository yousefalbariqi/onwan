// Request-local diagnostics only: labels and milliseconds, never user data.
export function serverTiming(res: any) {
  const started = performance.now();
  const entries: string[] = [];
  const record = (name: string, start: number) => {
    entries.push(`${name};dur=${Math.max(0, performance.now() - start).toFixed(2)}`);
  };
  return {
    async measure<T>(name: string, action: () => T): Promise<Awaited<T>> {
      const start = performance.now();
      try { return await action(); } finally { record(name, start); }
    },
    sync<T>(name: string, action: () => T): T {
      const start = performance.now();
      try { return action(); } finally { record(name, start); }
    },
    flush() {
      if (res.headersSent) return;
      res.setHeader('Server-Timing', [...entries, `total;dur=${Math.max(0, performance.now() - started).toFixed(2)}`].join(', '));
    },
  };
}
