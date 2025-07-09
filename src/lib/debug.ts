/**
 * Debug utility for conditional logging based on NEXT_PUBLIC_MODE environment variable
 * 
 * Usage:
 * - debugLog('message', data) - Only logs in develop mode
 * - debugError('error message', error) - Only logs in develop mode
 * - debugWarn('warning message', data) - Only logs in develop mode
 */

const isDevelopMode = process.env.NEXT_PUBLIC_MODE === 'develop';

/**
 * Conditional console.log - only works in develop mode
 */
export const debugLog = (message: string, ...args: any[]) => {
  if (isDevelopMode) {
    console.log(`🔍 DEBUG: ${message}`, ...args);
  }
};

/**
 * Conditional console.error - only works in develop mode
 */
export const debugError = (message: string, ...args: any[]) => {
  if (isDevelopMode) {
    console.error(`❌ DEBUG ERROR: ${message}`, ...args);
  }
};

/**
 * Conditional console.warn - only works in develop mode
 */
export const debugWarn = (message: string, ...args: any[]) => {
  if (isDevelopMode) {
    console.warn(`⚠️ DEBUG WARN: ${message}`, ...args);
  }
};

/**
 * Conditional console.info - only works in develop mode
 */
export const debugInfo = (message: string, ...args: any[]) => {
  if (isDevelopMode) {
    console.info(`ℹ️ DEBUG INFO: ${message}`, ...args);
  }
};

/**
 * Check if we're in development mode
 */
export const isDebugMode = (): boolean => {
  return isDevelopMode;
};

/**
 * Conditional performance timing - only works in develop mode
 */
export const debugTime = (label: string) => {
  if (isDevelopMode) {
    console.time(`⏱️ DEBUG TIME: ${label}`);
  }
};

export const debugTimeEnd = (label: string) => {
  if (isDevelopMode) {
    console.timeEnd(`⏱️ DEBUG TIME: ${label}`);
  }
};