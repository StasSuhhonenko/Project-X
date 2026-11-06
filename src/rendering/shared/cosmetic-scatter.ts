/** Stable substitute for an unrecovered visual random stream. Two independent
 * draws preserve the triangular random(n)-random(n) distribution. No gameplay,
 * particle or clock state is read or consumed; saved IDs replay the same ink. */
export function triangularOffset(sequence: number, salt: number, limit: number): number {
  if (limit <= 0) return 0;
  const draw = (offset: number): number => {
    let value = (sequence ^ offset) >>> 0;
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    return ((value ^ (value >>> 16)) >>> 0) % limit;
  };
  return draw(salt) - draw(salt ^ 0x9e3779b9);
}
