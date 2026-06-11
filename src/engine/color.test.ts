import { hexToRgb, jitterInk } from './color';
import { mulberry32 } from './rng';

describe('hexToRgb', () => {
  it('hex を 0..1 の RGB に変換する', () => {
    expect(hexToRgb('#ff0000')).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 1 });
  });

  it('中間色も変換できる', () => {
    const rgb = hexToRgb('#807f40');
    expect(rgb.r).toBeCloseTo(128 / 255, 5);
    expect(rgb.g).toBeCloseTo(127 / 255, 5);
    expect(rgb.b).toBeCloseTo(64 / 255, 5);
  });
});

describe('jitterInk', () => {
  it('元の色からおおきく外れない', () => {
    const base = hexToRgb('#165e83');
    for (let seed = 1; seed <= 20; seed++) {
      const jittered = jitterInk('#165e83', mulberry32(seed));
      expect(Math.abs(jittered.r - base.r)).toBeLessThan(0.2);
      expect(Math.abs(jittered.g - base.g)).toBeLessThan(0.2);
      expect(Math.abs(jittered.b - base.b)).toBeLessThan(0.2);
    }
  });

  it('値は 0..1 に収まる', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const jittered = jitterInk('#ffffff', mulberry32(seed));
      expect(jittered.r).toBeLessThanOrEqual(1);
      expect(jittered.g).toBeLessThanOrEqual(1);
      expect(jittered.b).toBeLessThanOrEqual(1);
    }
  });

  it('呼ぶたびに違う表情になる', () => {
    const rng = mulberry32(7);
    const a = jitterInk('#165e83', rng);
    const b = jitterInk('#165e83', rng);
    expect(a).not.toEqual(b);
  });
});
