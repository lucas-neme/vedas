/** Arredonda para 2 casas evitando erros clássicos de ponto flutuante. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Arredonda quantidades para 3 casas (produtos vendidos a granel). */
export function round3(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function formatDecimal(value: number, digits = 2): string {
  return value.toFixed(digits);
}
