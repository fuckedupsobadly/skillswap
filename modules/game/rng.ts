/** xoshiro128** — a small, fast, well-tested seeded generator. Same seed, same kitty, on any machine. */
export function xoshiro128(seed: [number, number, number, number]) {
  let [a, b, c, d] = seed.map((x) => x >>> 0);
  if ((a | b | c | d) === 0) a = 1;
  const rotl = (x: number, k: number) => (x << k) | (x >>> (32 - k));
  return () => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9) >>> 0;
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return r / 4294967296;
  };
}

export function seedFromHex(hex: string): [number, number, number, number] {
  return [0, 8, 16, 24].map((i) => Number.parseInt(hex.slice(i, i + 8), 16) >>> 0) as [
    number,
    number,
    number,
    number,
  ];
}

/** Pick an index from a weight table. */
export function weighted(rand: () => number, weights: readonly number[]): number {
  const total = weights.reduce((a, w) => a + w, 0);
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
