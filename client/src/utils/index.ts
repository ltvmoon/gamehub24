export function formatNumber(num: number) {
  // 1000 to 1.000
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function randInRange(
  min: number,
  max: number,
  floor: boolean = false,
): number {
  const diff = Math.random() * (max - min + 1);
  return min + (floor ? Math.floor(diff) : diff);
}
