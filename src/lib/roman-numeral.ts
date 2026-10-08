export function romanNumeral(order: number): string {
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return numerals[order - 1] || String(order);
}
