import { PALETTES } from '../engine/palettes';
import type { Palette } from '../engine/palettes';
import { INK_SLOTS } from './ink-slots';

import styles from './custom-palette-editor.module.css';

type CustomPaletteEditorProps = {
  palette: Palette;
  onChange: (paper: string, inks: readonly string[]) => void;
};

/** じぶんいろをえらぶエディタ。えのぐ5色とキャンバスの色 */
export function CustomPaletteEditor({
  palette,
  onChange,
}: CustomPaletteEditorProps) {
  const setInk = (index: number, color: string) => {
    onChange(
      palette.paper,
      palette.inks.map((ink, i) => (i === index ? color : ink)),
    );
  };

  return (
    <div className={styles.root}>
      <p className={styles.title}>じぶんいろをえらぶ</p>
      <div className={styles.row}>
        {palette.inks.map((ink, index) => (
          <input
            key={INK_SLOTS[index] ?? ink}
            aria-label={`えのぐ ${index + 1} の色`}
            className={styles.picker}
            type="color"
            value={ink}
            onChange={(event) => {
              setInk(index, event.target.value);
            }}
          />
        ))}
        <span aria-hidden className={styles.divider} />
        <input
          aria-label="キャンバスの色"
          className={styles.picker}
          type="color"
          value={palette.paper}
          onChange={(event) => {
            onChange(event.target.value, palette.inks);
          }}
        />
      </div>
      <p className={styles.note}>左がえのぐ5色、右端がキャンバスの色</p>
      <div className={styles.presets}>
        <span className={styles.presetsLabel}>下敷きにする:</span>
        {PALETTES.map((preset) => (
          <button
            key={preset.id}
            className={styles.preset}
            type="button"
            onClick={() => {
              onChange(preset.paper, [...preset.inks]);
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
}
