import { DEFAULT_PALETTE, findPalette, PALETTES } from './palettes';

const HEX_COLOR = /^#[0-9a-f]{6}$/u;

describe('PALETTES', () => {
  it('id が重複していない', () => {
    const ids = PALETTES.map((palette) => palette.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('紙とインクはすべて 6 桁の hex カラー', () => {
    for (const palette of PALETTES) {
      expect(palette.paper).toMatch(HEX_COLOR);
      expect(palette.inks.length).toBeGreaterThanOrEqual(4);
      for (const ink of palette.inks) {
        expect(ink).toMatch(HEX_COLOR);
      }
    }
  });
});

describe('findPalette', () => {
  it('id からパレットを引ける', () => {
    for (const palette of PALETTES) {
      expect(findPalette(palette.id)).toBe(palette);
    }
  });

  it('未知の id は既定のパレットにフォールバックする', () => {
    expect(findPalette('unknown')).toBe(DEFAULT_PALETTE);
  });
});
