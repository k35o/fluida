import type { InkChoice, Palette } from '../engine/palettes';

type InkPickerProps = {
  palette: Palette;
  ink: InkChoice;
  onInkChange: (ink: InkChoice) => void;
};

const SWATCH_CLASS =
  'border-border-mute hover:border-border-emphasize block size-9 cursor-pointer rounded-full border transition-colors duration-150 ease-out has-[:checked]:ring-2 has-[:checked]:ring-primary-border has-[:checked]:ring-offset-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-border has-[:focus-visible]:ring-offset-2';

export function InkPicker({ palette, ink, onInkChange }: InkPickerProps) {
  return (
    <fieldset>
      <legend className="text-fg-mute mb-2.5 text-sm font-medium">いろ</legend>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="border-border-mute text-fg-mute has-[:checked]:border-primary-border has-[:checked]:bg-primary-bg-subtle has-[:checked]:text-fg-base hover:bg-bg-subtle hover:has-[:checked]:bg-primary-bg-subtle has-[:focus-visible]:ring-primary-border flex h-9 cursor-pointer items-center rounded-full border px-3.5 text-sm font-medium transition-colors duration-150 ease-out has-[:focus-visible]:ring-2">
          <input
            aria-label="じゅんばん（ひと滴ごとに色がめぐる）"
            checked={ink === 'auto'}
            className="sr-only"
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
            key={color}
            className={SWATCH_CLASS}
            style={{ backgroundColor: color }}
          >
            <input
              aria-label={`いろ ${index + 1}`}
              checked={ink === index}
              className="sr-only"
              name="ink"
              type="radio"
              value={index}
              onChange={() => {
                onInkChange(index);
              }}
            />
            <span className="sr-only">いろ {index + 1}</span>
          </label>
        ))}
        <label
          className={SWATCH_CLASS}
          style={{ backgroundColor: palette.paper }}
        >
          <input
            aria-label="キャンバスの色でいれる"
            checked={ink === 'paper'}
            className="sr-only"
            name="ink"
            type="radio"
            value="paper"
            onChange={() => {
              onInkChange('paper');
            }}
          />
          <span className="sr-only">キャンバスの色でいれる</span>
        </label>
      </div>
      <p className="text-fg-subtle mt-2 text-xs leading-relaxed">
        ひと滴ごとに色がめぐる「じゅんばん」がおすすめ。右端はキャンバスの色
      </p>
    </fieldset>
  );
}
