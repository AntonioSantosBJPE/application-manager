import { pino, stdTimeFunctions, type DestinationStream, type Level, type Logger } from 'pino';

export type { Logger };

export interface LoggerOptions {
  level: Level;
  /** Where JSON lines go; stdout when absent. Tests pass a stream to read the lines. */
  destination?: DestinationStream;
}

/** Server logger: one JSON line per entry with a text `level`, ISO `time` and `msg`, like the api. */
export function createLogger({ level, destination }: LoggerOptions): Logger {
  const options = {
    level,
    timestamp: stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
  };
  return destination ? pino(options, destination) : pino(options);
}
