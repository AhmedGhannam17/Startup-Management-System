import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility to merge Tailwind CSS classes without conflicts.
 * Used throughout the shadcn/ui component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
