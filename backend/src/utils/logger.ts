/* Minimal structured console logger. Kept dependency-free intentionally. */

type Meta = Record<string, unknown> | undefined;

function fmt(level: string, msg: string, meta?: Meta) {
  const time = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${time}] [${level}] ${msg}${metaStr}`;
}

export const logger = {
  info: (msg: string, meta?: Meta) => console.log(fmt('INFO', msg, meta)),
  warn: (msg: string, meta?: Meta) => console.warn(fmt('WARN', msg, meta)),
  error: (msg: string, meta?: Meta) => console.error(fmt('ERROR', msg, meta)),
  debug: (msg: string, meta?: Meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(fmt('DEBUG', msg, meta));
    }
  },
};
