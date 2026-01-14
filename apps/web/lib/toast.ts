// Safe toast wrapper that handles missing sonner module
// This file provides a fallback when sonner is not installed
// After running `pnpm install`, sonner will be available and toasts will work

// For now, use console as fallback until sonner is installed
// Once sonner is installed, replace this with: export { toast } from 'sonner';

export const toast = {
  success: (message: string, options?: any) => {
    console.log('[Toast Success]', message, options);
  },
  error: (message: string, options?: any) => {
    console.error('[Toast Error]', message, options);
  },
  info: (message: string, options?: any) => {
    console.log('[Toast Info]', message, options);
  },
  warning: (message: string, options?: any) => {
    console.warn('[Toast Warning]', message, options);
  },
};

