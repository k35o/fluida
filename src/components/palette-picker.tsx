import { cn } from '@k8o/arte-odyssey';

import { PALETTES, type Palette } from '../engine/palettes';
import { INK_SLOTS } from './ink-slots';

type PalettePickerProps = {
  paletteId: string;
  custom: Palette;
  onPaletteChange: (id: string) => void;
};

const CARD_CLASS =
  'border-border-mute has-[:checked]:border-primary-border has-[:checked]:bg-primary-bg-subtle hover:bg-bg-subtle hover:has-[:checked]:bg-primary-bg-subtle has-[:focus-visible]:ring-primary-border flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition-colors duration-150 ease-out has-[:focus-visible]:ring-2';

export function PalettePicker({
  paletteId,
  custom,
  onPaletteChange,
}: PalettePickerProps) {
  const options = [...PALETTES, custom];
  return (
    <fieldset>
      <legend className="text-fg-mute mb-2.5 text-sm font-medium">
        えのぐばこ
      </legend>
      <div className="grid grid-cols-2 gap-2 sm:max-lg:grid-cols-3">
        {options.map((palette) => (
          <label
            key={palette.id}
            className={cn(
              CARD_CLASS,
              palette.id === custom.id && 'col-span-full',
            )}
            title={palette.description}
          >
            <input
              aria-label={`${palette.name}（${palette.description}）`}
              checked={paletteId === palette.id}
              className="sr-only"
              name="palette"
              type="radio"
              value={palette.id}
              onChange={() => {
                onPaletteChange(palette.id);
              }}
            />
            <span className="text-fg-base text-sm font-medium">
              {palette.name}
            </span>
            <span
              className="border-border-subtle flex items-center gap-1.5 rounded-full border px-2.5 py-1.5"
              style={{ backgroundColor: palette.paper }}
            >
              {palette.inks.map((ink, index) => (
                <span
                  key={INK_SLOTS[index] ?? ink}
                  className="size-3.5 rounded-full"
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
