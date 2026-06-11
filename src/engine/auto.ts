import type { Palette } from './palettes';
import { pick, randomBetween, type Rng } from './rng';

/** 論理座標（0..1000）の正方形。session 側で uv に変換する */
export const ART_SIZE = 1000;

/** おまかせ生成のアクション。t 秒後に実行される */
export type AutoAction =
  | {
      t: number;
      kind: 'drop';
      x: number;
      y: number;
      radius: number;
      color: string;
    }
  | {
      t: number;
      kind: 'sweep';
      y: number;
      dirY: 1 | -1;
      spacing: number;
      strength: number;
    }
  | {
      t: number;
      kind: 'swirl';
      x: number;
      y: number;
      radius: number;
      strength: number;
    };

const PATTERNS = ['rings', 'bloom', 'scatter', 'stripes'] as const;

/**
 * おまかせ生成の台本を作る。純粋関数なのでシードから再現可能。
 * 時間差で実行することで、インクが咲いていくアニメーションになる。
 */
export function generateAutoScript(palette: Palette, rng: Rng): AutoAction[] {
  const actions: AutoAction[] = [];
  switch (pick(rng, PATTERNS)) {
    case 'rings': {
      addRings(actions, palette, rng);
      break;
    }
    case 'bloom': {
      const [cx, cy, end] = addRings(actions, palette, rng);
      actions.push({
        t: end + 0.4,
        kind: 'swirl',
        x: cx,
        y: cy,
        radius: randomBetween(rng, 260, 400),
        strength: randomBetween(rng, 0.7, 1.3) * (rng() < 0.5 ? -1 : 1),
      });
      break;
    }
    case 'scatter': {
      addScatter(actions, palette, rng);
      break;
    }
    case 'stripes': {
      addStripes(actions, palette, rng);
      break;
    }
  }
  return actions.toSorted((a, b) => a.t - b.t);
}

/**
 * 同心円。ひと滴ずつ間をあけて落とし、前のインクが押し広げられて
 * 輪になる時間を確保する。ところどころキャンバスの色を挟む。
 */
function addRings(
  actions: AutoAction[],
  palette: Palette,
  rng: Rng,
): [number, number, number] {
  const cx = ART_SIZE / 2 + randomBetween(rng, -120, 120);
  const cy = ART_SIZE / 2 + randomBetween(rng, -120, 120);
  const count = Math.floor(randomBetween(rng, 8, 12));
  const startInk = Math.floor(rng() * palette.inks.length);
  let t = 0;
  for (let i = 0; i < count; i++) {
    const color =
      i % 4 === 3
        ? palette.paper
        : (palette.inks[(startInk + i) % palette.inks.length] ?? palette.paper);
    const radius = randomBetween(rng, 55, 95);
    actions.push({
      t,
      kind: 'drop',
      x: cx + randomBetween(rng, -8, 8),
      y: cy + randomBetween(rng, -8, 8),
      radius,
      color,
    });
    t += randomBetween(rng, 0.28, 0.42);
  }
  return [cx, cy, t];
}

/** 散らし。あちこちに間をあけて落とす */
function addScatter(actions: AutoAction[], palette: Palette, rng: Rng): void {
  const count = Math.floor(randomBetween(rng, 12, 18));
  const startInk = Math.floor(rng() * palette.inks.length);
  let t = 0;
  for (let i = 0; i < count; i++) {
    actions.push({
      t,
      kind: 'drop',
      x: randomBetween(rng, 120, ART_SIZE - 120),
      y: randomBetween(rng, 120, ART_SIZE - 120),
      radius: randomBetween(rng, 30, 75),
      color:
        palette.inks[(startInk + i) % palette.inks.length] ?? palette.paper,
    });
    t += randomBetween(rng, 0.12, 0.22);
  }
}

/** 縞。列に並べたしずくを、櫛の流れで縦に流す */
function addStripes(actions: AutoAction[], palette: Palette, rng: Rng): void {
  const rows = rng() < 0.5 ? 2 : 3;
  const startInk = Math.floor(rng() * palette.inks.length);
  let inkIndex = startInk;
  let t = 0;
  for (let row = 0; row < rows; row++) {
    const y = (ART_SIZE * (row + 1)) / (rows + 1) + randomBetween(rng, -40, 40);
    const cols = Math.floor(randomBetween(rng, 5, 8));
    for (let col = 0; col < cols; col++) {
      const x = (ART_SIZE * (col + 0.5)) / cols + randomBetween(rng, -30, 30);
      actions.push({
        t,
        kind: 'drop',
        x,
        y,
        radius: randomBetween(rng, 45, 70),
        color: palette.inks[inkIndex % palette.inks.length] ?? palette.paper,
      });
      inkIndex++;
      t += randomBetween(rng, 0.03, 0.07);
    }
  }
  const dirY: 1 | -1 = rng() < 0.5 ? 1 : -1;
  const spacing = randomBetween(rng, 80, 140);
  const strength = randomBetween(rng, 0.35, 0.6);
  const sweepStart = t + 0.5;
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const progress = i / (steps - 1);
    actions.push({
      t: sweepStart + i * 0.05,
      kind: 'sweep',
      y: dirY === 1 ? progress * ART_SIZE : (1 - progress) * ART_SIZE,
      dirY,
      spacing,
      strength,
    });
  }
}
