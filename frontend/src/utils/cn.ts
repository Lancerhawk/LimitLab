import { clsx, type ClassValue } from 'clsx';

/**
 * Utility function to merge Tailwind classes cleanly.
 * Note: When `tailwind-merge` is installed, it should wrap `clsx`.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
