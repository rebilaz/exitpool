// Lightweight logger with optional request id tagging

interface LogFields { [k: string]: unknown }

function fmt(fields: LogFields): string {
  return Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
}

export const logger = {
  info(msg: string, fields: LogFields = {}) {
    console.log(`[INFO] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  warn(msg: string, fields: LogFields = {}) {
    console.warn(`[WARN] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  error(msg: string, fields: LogFields = {}) {
    console.error(`[ERROR] ${msg}` + (Object.keys(fields).length ? ' ' + fmt(fields) : ''));
  },
  withRid(rid?: string) {
    return {
      info: (m: string, f: LogFields = {}) => logger.info(m, { rid, ...f }),
      warn: (m: string, f: LogFields = {}) => logger.warn(m, { rid, ...f }),
      error: (m: string, f: LogFields = {}) => logger.error(m, { rid, ...f }),
    };
  },
};

export default logger;
