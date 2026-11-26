// Logger estructurado en JSON. Cada linea es un objeto con nivel, mensaje,
// timestamp y, cuando existe, el trace_id del request que la origino.
// Sin dependencias: suficiente para el TP y facil de reemplazar por pino.

type Level = 'debug' | 'info' | 'warn' | 'error';

type LogFields = Record<string, unknown>;

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return err;
}

function write(level: Level, msg: string, fields: LogFields = {}): void {
  const entry: LogFields = {
    level,
    time: new Date().toISOString(),
    msg,
    ...fields,
  };
  if ('err' in entry) entry.err = serializeError(entry.err);

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

function createLogger(bindings: LogFields = {}): Logger {
  return {
    debug: (msg, fields) => write('debug', msg, { ...bindings, ...fields }),
    info: (msg, fields) => write('info', msg, { ...bindings, ...fields }),
    warn: (msg, fields) => write('warn', msg, { ...bindings, ...fields }),
    error: (msg, fields) => write('error', msg, { ...bindings, ...fields }),
    child: (extra) => createLogger({ ...bindings, ...extra }),
  };
}

export const logger = createLogger({ service: 'burger-server' });
