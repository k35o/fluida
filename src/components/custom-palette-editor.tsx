import { PALETTES, type Palette } from '../engine/palettes';

type CustomPaletteEditorProps = {
  palette: Palette;
  onChange: (paper: string, inks: readonly string[]) => void;
};

/** えのぐは固定5枠。並び位置そのものが同一性なのでキーに使う */
const INK_SLOTS = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'];

const PICKER_CLASS =
  'border-border-mute hover:border-border-emphasize focus-visible:ring-primary-border block size-9 cursor-pointer appearance-none rounded-full border bg-transparent p-0 outline-none transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-offset-2 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0';

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
    <div className="border-border-mute bg-bg-subtle flex flex-col gap-2.5 rounded-2xl border p-3.5">
      <p className="text-fg-mute text-xs font-medium">じぶんいろをえらぶ</p>
      <div className="flex flex-wrap items-center gap-2.5">
        {palette.inks.map((ink, index) => (
          <input
            key={INK_SLOTS[index] ?? ink}
            aria-label={`えのぐ ${index + 1} の色`}
            className={PICKER_CLASS}
            type="color"
            value={ink}
            onChange={(event) => {
              setInk(index, event.target.value);
            }}
          />
        ))}
        <span aria-hidden className="bg-border-mute h-6 w-px" />
        <input
          aria-label="キャンバスの色"
          className={PICKER_CLASS}
          type="color"
          value={palette.paper}
          onChange={(event) => {
            onChange(event.target.value, palette.inks);
          }}
        />
      </div>
      <p className="text-fg-subtle text-xs">
        左がえのぐ5色、右端がキャンバスの色
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-fg-subtle mr-0.5 text-xs">下敷きにする:</span>
        {PALETTES.map((preset) => (
          <button
            key={preset.id}
            className="border-border-mute text-fg-mute hover:bg-bg-mute hover:text-fg-base focus-visible:ring-primary-border cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors duration-150 ease-out outline-none focus-visible:ring-2"
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
