type LogFn = (...args: unknown[]) => void;

const shouldSuppressTestLogs =
  process.env.NODE_ENV === "test" && process.env.FAROWAY_TEST_LOGS !== "1";

function write(log: LogFn, args: unknown[]) {
  if (shouldSuppressTestLogs) return;
  log(...args);
}

export const logger = {
  info: (...args: unknown[]) => write(console.log, args),
  warn: (...args: unknown[]) => write(console.warn, args),
  error: (...args: unknown[]) => write(console.error, args),
};
