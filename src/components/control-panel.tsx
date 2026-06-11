import {
  Button,
  Card,
  Separator,
  Slider,
  SparklesIcon,
} from '@k8o/arte-odyssey';

import type { InkChoice, Palette } from '../engine/palettes';
import type { Tool } from '../engine/session';
import { CustomPaletteEditor } from './custom-palette-editor';
import { InkPicker } from './ink-picker';
import { PalettePicker } from './palette-picker';
import { ToolPicker } from './tool-picker';

type ControlPanelProps = {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  params: Record<Tool, number>;
  onParamChange: (tool: Tool, value: number) => void;
  paletteId: string;
  onPaletteChange: (id: string) => void;
  /** 選択中のパレット（カスタム解決済み） */
  palette: Palette;
  customPalette: Palette;
  onCustomChange: (paper: string, inks: readonly string[]) => void;
  ink: InkChoice;
  onInkChange: (ink: InkChoice) => void;
  onAuto: () => void;
};

const SLIDERS: Record<Tool, { label: string; min: number; max: number }> = {
  drop: { label: 'しずくの大きさ', min: 16, max: 110 },
  flow: { label: 'ふでの太さ', min: 40, max: 220 },
  comb: { label: 'くしの間隔', min: 60, max: 240 },
  vortex: { label: 'うずの広さ', min: 100, max: 420 },
};

export function ControlPanel({
  tool,
  onToolChange,
  params,
  onParamChange,
  paletteId,
  onPaletteChange,
  palette,
  customPalette,
  onCustomChange,
  ink,
  onInkChange,
  onAuto,
}: ControlPanelProps) {
  const slider = SLIDERS[tool];

  return (
    <Card>
      <div className="flex flex-col gap-7 p-6">
        <div className="flex flex-col gap-5">
          <ToolPicker tool={tool} onToolChange={onToolChange} />
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <p className="text-fg-mute text-sm font-medium">{slider.label}</p>
              <span className="text-fg-subtle text-xs tabular-nums">
                {params[tool]}
              </span>
            </div>
            <Slider
              max={slider.max}
              min={slider.min}
              step={1}
              value={params[tool]}
              onChange={(value) => {
                onParamChange(tool, value);
              }}
            />
          </div>
        </div>
        <Separator color="subtle" orientation="horizontal" />
        <div className="flex flex-col gap-5">
          <PalettePicker
            custom={customPalette}
            paletteId={paletteId}
            onPaletteChange={onPaletteChange}
          />
          {paletteId === customPalette.id ? (
            <CustomPaletteEditor
              palette={customPalette}
              onChange={onCustomChange}
            />
          ) : null}
          <InkPicker ink={ink} palette={palette} onInkChange={onInkChange} />
        </div>
        <Separator color="subtle" orientation="horizontal" />
        <Button
          color="primary"
          fullWidth
          size="md"
          startIcon={<SparklesIcon size="sm" />}
          onClick={onAuto}
        >
          おまかせで描く
        </Button>
      </div>
    </Card>
  );
}
