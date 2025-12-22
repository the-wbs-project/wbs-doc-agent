type Level = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(base: LogContext = {}) {
  const log = (level: Level, msg: string, data: LogContext = {}) => {
    const line = {
      ts: new Date().toISOString(),
      level,
      ...base,
      ...data
    };
    // plenty of organized console.logs as requested
    console.log(`${level}: ${msg} - ${JSON.stringify(line)}`);
  };

  return {
    with(more: LogContext) {
      return createLogger({ ...base, ...more });
    },
    info(msg: string, data?: LogContext) { log("info", msg, data); },
    warn(msg: string, data?: LogContext) { log("warn", msg, data); },
    error(msg: string, data?: LogContext) { log("error", msg, data); },
    exception(msg: string, error: any) { log("error", msg, { message: error.message, stack: error.stack }); }
  };
}

export const logger = createLogger();
