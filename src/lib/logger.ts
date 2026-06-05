type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface Logger {
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  debug: (msg: string, ...args: unknown[]) => void;
}

function prefix(level: LogLevel, ns: string): string {
  return `[${new Date().toISOString()}] [${level.padEnd(5)}] [${ns}]`;
}

export function createLogger(namespace: string): Logger {
  return {
    info: (msg, ...args) => console.info(`${prefix('INFO', namespace)} ${msg}`, ...args),
    warn: (msg, ...args) => console.warn(`${prefix('WARN', namespace)} ${msg}`, ...args),
    error: (msg, ...args) => console.error(`${prefix('ERROR', namespace)} ${msg}`, ...args),
    debug: (msg, ...args) => {
      if (import.meta.env.DEV) console.debug(`${prefix('DEBUG', namespace)} ${msg}`, ...args);
    },
  };
}
