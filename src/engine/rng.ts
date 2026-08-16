export type Rng = () => number;

/** 再現可能な乱数列を生成する（テスト・おまかせ生成用） */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d_2b_79_f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function randomBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  const index = Math.min(Math.floor(rng() * items.length), items.length - 1);
  const item = items[index];
  if (item === undefined) {
    throw new Error('Cannot pick from an empty list');
  }
  return item;
}
