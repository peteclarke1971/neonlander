/**
 * Production-safe logger utility
 * 
 * Only logs in development mode to prevent information leakage
 * in production builds. Errors are always logged for monitoring.
 */

const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]): void => {
    if (isDev) console.log(...args);
  },
  info: (...args: unknown[]): void => {
    if (isDev) console.info(...args);
  },
  warn: (...args: unknown[]): void => {
    if (isDev) console.warn(...args);
  },
  error: (...args: unknown[]): void => {
    // Always log errors for monitoring
    console.error(...args);
  },
};
