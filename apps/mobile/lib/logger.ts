const shouldLog = typeof __DEV__ !== 'undefined' && __DEV__ && process.env.NODE_ENV !== 'test';

type LogMethod = (...args: unknown[]) => void;

function logWith(method: LogMethod, args: unknown[]) {
  if (shouldLog) {
    method(...args);
  }
}

export const logger = {
  debug: (...args: unknown[]) => logWith(console.debug, args),
  info: (...args: unknown[]) => logWith(console.info, args),
  warn: (...args: unknown[]) => logWith(console.warn, args),
  error: (...args: unknown[]) => logWith(console.error, args),
};
