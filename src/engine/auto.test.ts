import { ART_SIZE, generateAutoScript, type AutoAction } from './auto';
import { DEFAULT_PALETTE } from './palettes';
import { mulberry32 } from './rng';

function dropActions(
  actions: AutoAction[],
): Array<Extract<AutoAction, { kind: 'drop' }>> {
  return actions.filter((action) => action.kind === 'drop');
}

function signature(actions: AutoAction[]): string {
  return actions
    .map((action) =>
      action.kind === 'drop'
        ? `${action.kind}@${Math.round(action.x)},${Math.round(action.y)}:${action.color}`
        : `${action.kind}@${action.t.toFixed(3)}`,
    )
    .join('|');
}

describe('generateAutoScript', () => {
  it('まとまった数のアクションを生成する', () => {
    const actions = generateAutoScript(DEFAULT_PALETTE, mulberry32(1));
    expect(actions.length).toBeGreaterThan(8);
  });

  it('実行時刻が昇順に並んでいる', () => {
    const actions = generateAutoScript(DEFAULT_PALETTE, mulberry32(3));
    const times = actions.map((action) => action.t);
    expect(times).toEqual(times.toSorted((a, b) => a - b));
  });

  it('しずくの座標はキャンバス内、色はパレット由来になる', () => {
    const valid = new Set([...DEFAULT_PALETTE.inks, DEFAULT_PALETTE.paper]);
    for (let seed = 1; seed <= 8; seed++) {
      const actions = generateAutoScript(DEFAULT_PALETTE, mulberry32(seed));
      for (const action of dropActions(actions)) {
        expect(action.x).toBeGreaterThanOrEqual(0);
        expect(action.x).toBeLessThanOrEqual(ART_SIZE);
        expect(action.y).toBeGreaterThanOrEqual(0);
        expect(action.y).toBeLessThanOrEqual(ART_SIZE);
        expect(valid.has(action.color)).toBe(true);
      }
    }
  });

  it('同じシードからは同じ台本が生まれる', () => {
    const a = generateAutoScript(DEFAULT_PALETTE, mulberry32(42));
    const b = generateAutoScript(DEFAULT_PALETTE, mulberry32(42));
    expect(signature(a)).toBe(signature(b));
  });

  it('シードが違えば違う台本になる', () => {
    const a = generateAutoScript(DEFAULT_PALETTE, mulberry32(1));
    const b = generateAutoScript(DEFAULT_PALETTE, mulberry32(2));
    expect(signature(a)).not.toBe(signature(b));
  });
});
