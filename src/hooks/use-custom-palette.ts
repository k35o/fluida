import { useState } from 'react';

import { DEFAULT_PALETTE, type Palette } from '../engine/palettes';

export const CUSTOM_PALETTE_ID = 'custom';

const STORAGE_KEY = 'fluida:custom-palette';
const HEX_COLOR = /^#[0-9a-f]{6}$/u;

type StoredPalette = {
  paper: string;
  inks: string[];
};

function isStoredPalette(value: unknown): value is StoredPalette {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { paper?: unknown; inks?: unknown };
  return (
    typeof candidate.paper === 'string' &&
    HEX_COLOR.test(candidate.paper) &&
    Array.isArray(candidate.inks) &&
    candidate.inks.length === DEFAULT_PALETTE.inks.length &&
    candidate.inks.every(
      (ink) => typeof ink === 'string' && HEX_COLOR.test(ink),
    )
  );
}

function loadStored(): StoredPalette | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredPalette(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * じぶんでえらんだ色のパレット。localStorage に保存され、
 * リロードしても残る。
 */
export function useCustomPalette(): [
  Palette,
  (paper: string, inks: readonly string[]) => void,
] {
  const [stored, setStored] = useState<StoredPalette>(
    () =>
      loadStored() ?? {
        paper: DEFAULT_PALETTE.paper,
        inks: [...DEFAULT_PALETTE.inks],
      },
  );

  const palette: Palette = {
    id: CUSTOM_PALETTE_ID,
    name: 'じぶんいろ',
    description: 'じぶんでえらんだ色',
    paper: stored.paper,
    inks: stored.inks,
  };

  const update = (paper: string, inks: readonly string[]) => {
    const next: StoredPalette = { paper, inks: [...inks] };
    setStored(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 保存できない環境ではセッション中のみ有効
    }
  };

  return [palette, update];
}
