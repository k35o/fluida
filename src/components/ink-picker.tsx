import type { InkChoice, Palette } from '../engine/palettes';
import { INK_SLOTS } from './ink-slots';

import styles from './ink-picker.module.css';
import picker from './picker.module.css';

type InkPickerProps = {
  palette: Palette;
  ink: InkChoice;
  onInkChange: (ink: InkChoice) => void;
};

export function InkPicker({ palette, ink, onInkChange }: InkPickerProps) {
  return (
    <fieldset>
      <legend className={picker.legend}>いろ</legend>
      <div className={styles.row}>
        <label className={`${picker.option} ${styles.cycle}`}>
          <input
            aria-label="じゅんばん（ひと滴ごとに色がめぐる）"
            checked={ink === 'auto'}
            className={picker.srOnly}
            name="ink"
            type="radio"
            value="auto"
            onChange={() => {
              onInkChange('auto');
            }}
          />
          じゅんばん
        </label>
        {palette.inks.map((color, index) => (
          <label
            key={INK_SLOTS[index] ?? index}
            className={picker.swatch}
            style={{ backgroundColor: color }}
          >
            <input
              aria-label={`いろ ${index + 1}`}
              checked={ink === index}
              className={picker.srOnly}
              name="ink"
              type="radio"
              value={index}
              onChange={() => {
                onInkChange(index);
              }}
            />
            <span className={picker.srOnly}>いろ {index + 1}</span>
          </label>
        ))}
        <label
          className={picker.swatch}
          style={{ backgroundColor: palette.paper }}
        >
          <input
            aria-label="キャンバスの色でいれる"
            checked={ink === 'paper'}
            className={picker.srOnly}
            name="ink"
            type="radio"
            value="paper"
            onChange={() => {
              onInkChange('paper');
            }}
          />
          <span className={picker.srOnly}>キャンバスの色でいれる</span>
        </label>
      </div>
      <p className={styles.note}>
        ひと滴ごとに色がめぐる「じゅんばん」がおすすめ。右端はキャンバスの色
      </p>
    </fieldset>
  );
}
