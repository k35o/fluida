import type { Rng } from './rng';

export type RGB = {
  r: number;
  g: number;
  b: number;
};

/** '#rrggbb' を 0..1 の RGB に変換する */
export function hexToRgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: ((value >> 16) & 0xff) / 255,
    g: ((value >> 8) & 0xff) / 255,
    b: (value & 0xff) / 255,
  };
}

const LIGHTNESS_JITTER = 0.12;
const CHANNEL_JITTER = 0.04;

/**
 * 色相を保ったまま明度を tone 倍した色を返す（濃淡づけ）。
 * チャンネルごとの ±4% の揺らぎで、塗料らしいむらも加える。
 */
export function toneInk(hex: string, tone: number, rng: Rng): RGB {
  const base = hexToRgb(hex);
  const channel = () => 1 + (rng() * 2 - 1) * CHANNEL_JITTER;
  return {
    r: clamp01(base.r * tone * channel()),
    g: clamp01(base.g * tone * channel()),
    b: clamp01(base.b * tone * channel()),
  };
}

/**
 * インク色にランダムな揺らぎを与える。明度をまとめて ±12%、
 * さらにチャンネルごとに ±4% ずらすことで、
 * 同じインクでもひと滴ごとに表情が変わる。
 */
export function jitterInk(hex: string, rng: Rng): RGB {
  return toneInk(hex, 1 + (rng() * 2 - 1) * LIGHTNESS_JITTER, rng);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
