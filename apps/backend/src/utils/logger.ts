const ts = () => new Date().toISOString();

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.info(JSON.stringify({ ts: ts(), level: 'info', msg, ...meta })),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(JSON.stringify({ ts: ts(), level: 'warn', msg, ...meta })),
  error: (msg: string, meta?: Record<string, unknown>) =>
    console.error(JSON.stringify({ ts: ts(), level: 'error', msg, ...meta })),
};
