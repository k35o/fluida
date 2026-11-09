import { PALETTES, type Palette } from '../engine/palettes';
import { INK_SLOTS } from './ink-slots';

import styles from './palette-picker.module.css';
import picker from './picker.module.css';

type PalettePickerProps = {
  paletteId: string;
  custom: Palette;
  onPaletteChange: (id: string) => void;
};

export function PalettePicker({
  paletteId,
  custom,
  onPaletteChange,
}: PalettePickerProps) {
  const options = [...PALETTES, custom];
  return (
    <fieldset>
      <legend className={picker.legend}>えのぐばこ</legend>
      <div className={styles.grid}>
        {options.map((palette) => (
          <label
            key={palette.id}
            className={`${picker.option} ${styles.palette}`}
            data-wide={palette.id === custom.id}
            title={palette.description}
          >
            <input
              aria-label={`${palette.name}（${palette.description}）`}
              checked={paletteId === palette.id}
              className={picker.srOnly}
              name="palette"
              type="radio"
              value={palette.id}
              onChange={() => {
                onPaletteChange(palette.id);
              }}
            />
            <span className={styles.name}>{palette.name}</span>
            <span
              className={styles.strip}
              style={{ backgroundColor: palette.paper }}
            >
              {palette.inks.map((ink, index) => (
                <span
                  key={INK_SLOTS[index] ?? ink}
                  className={styles.dot}
                  style={{ backgroundColor: ink }}
                />
              ))}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
