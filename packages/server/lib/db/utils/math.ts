export function bigIntMin(...values: bigint[]): bigint {
  return values.reduce((min, v) => (v < min ? v : min));
}

export function bigIntMax(...values: bigint[]): bigint {
  return values.reduce((max, v) => (v > max ? v : max));
}
