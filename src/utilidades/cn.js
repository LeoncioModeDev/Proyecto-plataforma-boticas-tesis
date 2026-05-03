import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases de Tailwind de forma inteligente.
 * Usa clsx para condicionales y twMerge para resolver conflictos.
 */
export function cn(...entradas) {
  return twMerge(clsx(entradas))
}
