/**
 * Formateo de moneda de Auctify. Importar desde `@/lib/money`.
 *
 * - `formatMoney`: importe completo con separadores de miles es-AR y prefijo de moneda
 *   (`$` para ARS, `US$` para USD). Ej: formatMoney(1234, 'ARS') → "$1.234".
 * - `formatMoneyCompact`: abreviatura K/M para stats (siempre en `$`).
 *   Ej: formatMoneyCompact(1_500_000) → "$1.5M".
 */

export type Currency = 'ARS' | 'USD';

/** Importe completo con prefijo de moneda y separadores de miles (es-AR). */
export function formatMoney(amount: number, currency: Currency): string {
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${prefix}${amount.toLocaleString('es-AR')}`;
}

/** Abreviatura compacta para stats (K/M), siempre con prefijo `$`. */
export function formatMoneyCompact(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}
